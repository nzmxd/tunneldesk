use std::collections::{HashMap, HashSet};
use std::process::Command;

use tauri::State;

use crate::config;
use crate::credential;
use crate::error::{to_command_error, AppError};
use crate::health;
use crate::hosts;
use crate::model::{
    AppSettings, AppStatus, AuthMethod, ProfilesFile, ServiceConfig, ServiceProfile, ServiceStatus,
    TunnelConfig, TunnelStatus,
};
use crate::startup;
use crate::state::AppState;
use crate::tunnel;
use crate::validation;

type CommandResult<T> = Result<T, String>;

#[tauri::command]
pub fn load_settings() -> CommandResult<AppSettings> {
    let mut settings = config::load_settings().map_err(to_command_error)?;
    settings.behavior.launch_at_login = startup::launch_at_login_enabled();
    Ok(settings)
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> CommandResult<AppSettings> {
    let profiles = config::load_profiles().unwrap_or_default();
    let mut normalized = settings;
    config::normalize_settings_credentials(&mut normalized);
    validation::validate_settings_with_profiles(&normalized, &profiles)
        .map_err(to_command_error)?;
    config::save_settings(&normalized).map_err(to_command_error)?;
    Ok(normalized)
}

#[tauri::command]
pub fn set_launch_at_login(enabled: bool) -> CommandResult<bool> {
    startup::set_launch_at_login(enabled).map_err(to_command_error)?;
    Ok(startup::launch_at_login_enabled())
}

#[tauri::command]
pub fn load_profiles() -> CommandResult<ProfilesFile> {
    config::load_profiles().map_err(to_command_error)
}

#[tauri::command]
pub fn save_profiles(profiles: ProfilesFile) -> CommandResult<ProfilesFile> {
    validation::validate_profiles(&profiles).map_err(to_command_error)?;
    let settings = config::load_settings().unwrap_or_default();
    validation::validate_tunnel_references(&settings, &profiles).map_err(to_command_error)?;
    config::save_profiles(&profiles).map_err(to_command_error)?;
    Ok(profiles)
}

#[tauri::command]
pub fn save_tunnel_password(tunnel_id: String, value: String) -> CommandResult<()> {
    if value.is_empty() {
        return Err(String::from("SSH password cannot be empty"));
    }
    let settings = config::load_settings().map_err(to_command_error)?;
    let tunnel = tunnel_by_id(&settings, &tunnel_id).map_err(to_command_error)?;
    credential::save_secret(&credential::tunnel_password_key(&tunnel.id), &value)
        .map_err(to_command_error)
}

#[tauri::command]
pub fn delete_tunnel_password(tunnel_id: String) -> CommandResult<()> {
    let settings = config::load_settings().map_err(to_command_error)?;
    let tunnel = tunnel_by_id(&settings, &tunnel_id).map_err(to_command_error)?;
    credential::delete_secret(&credential::tunnel_password_key(&tunnel.id))
        .map_err(to_command_error)
}

#[tauri::command]
pub fn has_tunnel_password(tunnel_id: String) -> CommandResult<bool> {
    let settings = config::load_settings().map_err(to_command_error)?;
    let tunnel = tunnel_by_id(&settings, &tunnel_id).map_err(to_command_error)?;
    Ok(credential::has_secret(&credential::tunnel_password_key(
        &tunnel.id,
    )))
}

#[tauri::command]
pub async fn test_ssh(tunnel_id: String) -> CommandResult<()> {
    let settings = config::load_settings().map_err(to_command_error)?;
    validation::validate_settings(&settings).map_err(to_command_error)?;
    let tunnel = tunnel_by_id(&settings, &tunnel_id).map_err(to_command_error)?;
    validation::validate_tunnel_for_connection(&tunnel).map_err(to_command_error)?;
    let password = password_for_tunnel(&tunnel).map_err(to_command_error)?;
    tunnel::test_ssh(&tunnel.ssh, password)
        .await
        .map_err(to_command_error)
}

#[tauri::command]
pub async fn start_profile(state: State<'_, AppState>) -> CommandResult<AppStatus> {
    start_profile_for_state(state.inner()).await
}

pub async fn start_profile_for_state(state: &AppState) -> CommandResult<AppStatus> {
    let already_running = {
        let guard = state
            .tunnels
            .lock()
            .map_err(|_| String::from("Tunnel state lock is poisoned"))?;
        !guard.is_empty()
    };
    if already_running {
        return get_status_for_state(state);
    }

    let settings = config::load_settings().map_err(to_command_error)?;
    let profiles = config::load_profiles().map_err(to_command_error)?;
    validation::validate_settings_with_profiles(&settings, &profiles).map_err(to_command_error)?;
    let profile = current_profile(&settings, &profiles).map_err(to_command_error)?;
    let enabled_services = profile
        .services
        .iter()
        .filter(|service| service.enabled)
        .cloned()
        .collect::<Vec<_>>();

    hosts::write_services_block(&enabled_services).map_err(to_command_error)?;
    let services_by_tunnel = group_services_by_tunnel(enabled_services);
    let tunnels_by_id = settings
        .tunnels
        .iter()
        .cloned()
        .map(|tunnel| (tunnel.id.clone(), tunnel))
        .collect::<HashMap<_, _>>();
    let mut start_plan = Vec::new();

    for (tunnel_id, services) in services_by_tunnel {
        let tunnel_config = tunnels_by_id
            .get(&tunnel_id)
            .cloned()
            .ok_or_else(|| format!("Tunnel not found: {tunnel_id}"))?;
        if !tunnel_config.enabled {
            let _ = hosts::remove_block();
            return Err(format!("Tunnel is disabled: {}", tunnel_config.name));
        }
        if let Err(error) = validation::validate_tunnel_for_connection(&tunnel_config) {
            let _ = hosts::remove_block();
            return Err(to_command_error(error));
        }
        let password = password_for_tunnel(&tunnel_config).map_err(|error| {
            let _ = hosts::remove_block();
            to_command_error(error)
        })?;
        start_plan.push((tunnel_config, services, password));
    }

    let mut runtimes = HashMap::new();

    for (tunnel_config, services, password) in start_plan {
        match tunnel::start(tunnel_config, services, password).await {
            Ok(runtime) => {
                runtimes.insert(runtime.tunnel_id().to_string(), runtime);
            }
            Err(error) => {
                for (_, runtime) in runtimes {
                    runtime.stop().await;
                }
                let _ = hosts::remove_block();
                return Err(to_command_error(error));
            }
        }
    }

    let mut guard = state
        .tunnels
        .lock()
        .map_err(|_| String::from("Tunnel state lock is poisoned"))?;
    *guard = runtimes;
    drop(guard);

    let mut active_profile = state
        .active_profile_id
        .lock()
        .map_err(|_| String::from("Active profile state lock is poisoned"))?;
    *active_profile = Some(profile.id.clone());
    drop(active_profile);

    get_status_for_state(state)
}

#[tauri::command]
pub async fn stop_profile(state: State<'_, AppState>) -> CommandResult<AppStatus> {
    let runtimes = {
        let mut guard = state
            .tunnels
            .lock()
            .map_err(|_| String::from("Tunnel state lock is poisoned"))?;
        std::mem::take(&mut *guard)
    };

    for (_, runtime) in runtimes {
        runtime.stop().await;
    }
    let mut active_profile = state
        .active_profile_id
        .lock()
        .map_err(|_| String::from("Active profile state lock is poisoned"))?;
    *active_profile = None;
    drop(active_profile);

    hosts::remove_block().map_err(to_command_error)?;
    get_status_for_state(state.inner())
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> CommandResult<AppStatus> {
    get_status_for_state(state.inner())
}

pub fn get_status_for_state(state: &AppState) -> CommandResult<AppStatus> {
    let started = std::time::Instant::now();
    let settings = config::load_settings().unwrap_or_default();
    let profiles = config::load_profiles().unwrap_or_default();
    let running_tunnel_ids = state
        .tunnels
        .lock()
        .ok()
        .map(|guard| {
            let mut ids = guard.keys().cloned().collect::<Vec<_>>();
            ids.sort();
            ids
        })
        .unwrap_or_default();
    let running = !running_tunnel_ids.is_empty();
    let running_tunnel_set = running_tunnel_ids.iter().cloned().collect::<HashSet<_>>();
    let active_profile = state
        .active_profile_id
        .lock()
        .ok()
        .and_then(|guard| guard.clone());
    let current_profile_id = active_profile.unwrap_or_else(|| settings.current_profile_id.clone());
    let services = profiles
        .profiles
        .iter()
        .find(|profile| profile.id == current_profile_id)
        .map(|profile| {
            collect_service_statuses(&profile.services, |service| {
                health::service_status(&service)
            })
        })
        .unwrap_or_default();
    let tunnel_statuses = settings
        .tunnels
        .iter()
        .map(|tunnel| TunnelStatus {
            tunnel_id: tunnel.id.clone(),
            name: tunnel.name.clone(),
            running: running_tunnel_set.contains(&tunnel.id),
            message: if running_tunnel_set.contains(&tunnel.id) {
                String::from("Running")
            } else if tunnel.enabled {
                String::from("Stopped")
            } else {
                String::from("Disabled")
            },
        })
        .collect::<Vec<_>>();

    let status = AppStatus {
        running,
        current_profile_id,
        running_tunnel_ids,
        tunnels: tunnel_statuses,
        is_admin: health::is_admin(),
        hosts_block_present: hosts::block_present(),
        message: if running {
            String::from("Running")
        } else {
            String::from("Stopped")
        },
        services,
    };

    tracing::info!(
        service_count = status.services.len(),
        elapsed_ms = started.elapsed().as_millis(),
        "Status refresh completed"
    );

    Ok(status)
}

fn collect_service_statuses<F>(services: &[ServiceConfig], checker: F) -> Vec<ServiceStatus>
where
    F: Fn(ServiceConfig) -> ServiceStatus + Sync,
{
    std::thread::scope(|scope| {
        let checker = &checker;
        let handles = services
            .iter()
            .cloned()
            .map(|service| scope.spawn(move || checker(service)))
            .collect::<Vec<_>>();

        handles
            .into_iter()
            .map(|handle| handle.join().expect("service status worker panicked"))
            .collect::<Vec<_>>()
    })
}

#[tauri::command]
pub fn test_service(service_id: String) -> CommandResult<ServiceStatus> {
    let profiles = config::load_profiles().map_err(to_command_error)?;
    for profile in profiles.profiles {
        if let Some(service) = profile
            .services
            .into_iter()
            .find(|service| service.id == service_id)
        {
            return Ok(health::service_status(&service));
        }
    }
    Err(format!("Service not found: {service_id}"))
}

#[tauri::command]
pub fn repair_hosts() -> CommandResult<()> {
    hosts::remove_block().map_err(to_command_error)
}

#[tauri::command]
pub fn open_log_dir() -> CommandResult<()> {
    let path = config::logs_dir().map_err(to_command_error)?;
    #[cfg(target_os = "windows")]
    let opener = "explorer";
    #[cfg(target_os = "linux")]
    let opener = "xdg-open";
    #[cfg(target_os = "macos")]
    let opener = "open";
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    return Err(String::from(
        "Opening log directory is not supported on this platform",
    ));

    Command::new(opener)
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn current_profile(
    settings: &AppSettings,
    profiles: &ProfilesFile,
) -> Result<ServiceProfile, AppError> {
    profiles
        .profiles
        .iter()
        .find(|profile| profile.id == settings.current_profile_id)
        .cloned()
        .or_else(|| profiles.profiles.first().cloned())
        .ok_or_else(|| AppError::Message(String::from("No service profile configured")))
}

fn tunnel_by_id(settings: &AppSettings, tunnel_id: &str) -> Result<TunnelConfig, AppError> {
    let tunnel_id = tunnel_id.trim();
    if tunnel_id.is_empty() {
        return Err(AppError::Message(String::from("Tunnel id is required")));
    }
    settings
        .tunnels
        .iter()
        .find(|tunnel| tunnel.id == tunnel_id)
        .cloned()
        .ok_or_else(|| AppError::Message(format!("Tunnel not found: {tunnel_id}")))
}

fn group_services_by_tunnel(services: Vec<ServiceConfig>) -> HashMap<String, Vec<ServiceConfig>> {
    let mut grouped = HashMap::new();
    for service in services {
        grouped
            .entry(service.tunnel_id.clone())
            .or_insert_with(Vec::new)
            .push(service);
    }
    grouped
}

fn password_for_tunnel(tunnel: &TunnelConfig) -> Result<Option<String>, AppError> {
    if tunnel.ssh.auth_method != AuthMethod::Password {
        return Ok(None);
    }
    let key = credential::tunnel_password_key(&tunnel.id);
    Ok(Some(credential::get_secret(&key)?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::ServiceState;

    fn service(id: &str) -> ServiceConfig {
        ServiceConfig {
            id: String::from(id),
            name: String::from(id),
            domain: format!("{id}.example.internal"),
            port: 3306,
            local_ip: String::from("127.77.0.10"),
            tunnel_id: String::from("default"),
            enabled: true,
        }
    }

    #[test]
    fn concurrent_status_collection_returns_each_service() {
        let services = vec![service("mysql"), service("redis")];

        let statuses = collect_service_statuses(&services, |service| ServiceStatus {
            service_id: service.id,
            state: ServiceState::Disabled,
            message: String::from("checked"),
        });

        assert_eq!(statuses.len(), 2);
        assert_eq!(statuses[0].service_id, "mysql");
        assert_eq!(statuses[1].service_id, "redis");
    }
}
