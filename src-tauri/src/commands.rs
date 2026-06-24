use std::process::Command;

use tauri::State;

use crate::config;
use crate::credential;
use crate::error::{to_command_error, AppError};
use crate::health;
use crate::hosts;
use crate::model::{
    AppSettings, AppStatus, AuthMethod, ProfilesFile, SecretPayload, ServiceProfile, ServiceStatus,
};
use crate::state::AppState;
use crate::tunnel;
use crate::validation;

type CommandResult<T> = Result<T, String>;

#[tauri::command]
pub fn load_settings() -> CommandResult<AppSettings> {
    config::load_settings().map_err(to_command_error)
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> CommandResult<AppSettings> {
    validation::validate_settings(&settings).map_err(to_command_error)?;
    config::save_settings(&settings).map_err(to_command_error)?;
    Ok(settings)
}

#[tauri::command]
pub fn load_profiles() -> CommandResult<ProfilesFile> {
    config::load_profiles().map_err(to_command_error)
}

#[tauri::command]
pub fn save_profiles(profiles: ProfilesFile) -> CommandResult<ProfilesFile> {
    validation::validate_profiles(&profiles).map_err(to_command_error)?;
    config::save_profiles(&profiles).map_err(to_command_error)?;
    Ok(profiles)
}

#[tauri::command]
pub fn save_secret(payload: SecretPayload) -> CommandResult<()> {
    credential::save_secret(&payload.key, &payload.value).map_err(to_command_error)
}

#[tauri::command]
pub fn delete_secret(key: String) -> CommandResult<()> {
    credential::delete_secret(&key).map_err(to_command_error)
}

#[tauri::command]
pub fn has_secret(key: String) -> bool {
    credential::has_secret(&key)
}

#[tauri::command]
pub async fn test_ssh(settings: AppSettings) -> CommandResult<()> {
    validation::validate_settings(&settings).map_err(to_command_error)?;
    let password = password_for_settings(&settings).map_err(to_command_error)?;
    tunnel::test_ssh(&settings.ssh, password)
        .await
        .map_err(to_command_error)
}

#[tauri::command]
pub async fn start_profile(state: State<'_, AppState>) -> CommandResult<AppStatus> {
    let already_running = {
        let guard = state
            .tunnel
            .lock()
            .map_err(|_| String::from("Tunnel state lock is poisoned"))?;
        guard.is_some()
    };
    if already_running {
        return get_status(state);
    }

    let settings = config::load_settings().map_err(to_command_error)?;
    validation::validate_settings(&settings).map_err(to_command_error)?;
    let profiles = config::load_profiles().map_err(to_command_error)?;
    validation::validate_profiles(&profiles).map_err(to_command_error)?;
    let profile = current_profile(&settings, &profiles).map_err(to_command_error)?;
    let enabled_services = profile
        .services
        .iter()
        .filter(|service| service.enabled)
        .cloned()
        .collect::<Vec<_>>();

    hosts::write_services_block(&enabled_services).map_err(to_command_error)?;
    let password = password_for_settings(&settings).map_err(|error| {
        let _ = hosts::remove_block();
        to_command_error(error)
    })?;

    let runtime = match tunnel::start(&settings.ssh, profile, password).await {
        Ok(runtime) => runtime,
        Err(error) => {
            let _ = hosts::remove_block();
            return Err(to_command_error(error));
        }
    };

    let mut guard = state
        .tunnel
        .lock()
        .map_err(|_| String::from("Tunnel state lock is poisoned"))?;
    *guard = Some(runtime);
    drop(guard);
    get_status(state)
}

#[tauri::command]
pub async fn stop_profile(state: State<'_, AppState>) -> CommandResult<AppStatus> {
    let runtime = {
        let mut guard = state
            .tunnel
            .lock()
            .map_err(|_| String::from("Tunnel state lock is poisoned"))?;
        guard.take()
    };

    if let Some(runtime) = runtime {
        runtime.stop().await;
    }
    hosts::remove_block().map_err(to_command_error)?;
    get_status(state)
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> CommandResult<AppStatus> {
    let settings = config::load_settings().unwrap_or_default();
    let profiles = config::load_profiles().unwrap_or_default();
    let running_profile = state.tunnel.lock().ok().and_then(|guard| {
        guard
            .as_ref()
            .map(|runtime| runtime.profile_id().to_string())
    });
    let running = running_profile.is_some();
    let current_profile_id = running_profile.unwrap_or_else(|| settings.current_profile_id.clone());
    let services = profiles
        .profiles
        .iter()
        .find(|profile| profile.id == current_profile_id)
        .map(|profile| {
            profile
                .services
                .iter()
                .map(health::service_status)
                .collect::<Vec<ServiceStatus>>()
        })
        .unwrap_or_default();

    Ok(AppStatus {
        running,
        current_profile_id,
        is_admin: health::is_admin(),
        hosts_block_present: hosts::block_present(),
        message: if running {
            String::from("Running")
        } else {
            String::from("Stopped")
        },
        services,
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
    Command::new("explorer")
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

fn password_for_settings(settings: &AppSettings) -> Result<Option<String>, AppError> {
    if settings.ssh.auth_method != AuthMethod::Password {
        return Ok(None);
    }
    let key = settings.ssh.password_credential_key.trim();
    if key.is_empty() {
        return Err(AppError::Credential(String::from(
            "Password credential key is empty",
        )));
    }
    Ok(Some(credential::get_secret(key)?))
}
