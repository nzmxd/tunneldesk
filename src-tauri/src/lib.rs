mod commands;
mod config;
mod credential;
mod error;
mod health;
mod hosts;
mod model;
mod startup;
mod state;
mod tunnel;
mod validation;

use state::AppState;
#[cfg(not(all(target_os = "linux", target_arch = "x86")))]
use tauri::menu::{Menu, MenuItem};
#[cfg(not(all(target_os = "linux", target_arch = "x86")))]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, RunEvent};

pub fn run() {
    init_logging();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::default())
        .setup(|app| {
            setup_tray(app)?;
            let startup_handle = app.handle().clone();

            let settings = config::load_settings().unwrap_or_default();
            if settings.behavior.start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            if settings.behavior.auto_repair_on_start {
                std::thread::spawn(|| {
                    let started = std::time::Instant::now();
                    match hosts::remove_block_if_present() {
                        Ok(true) => tracing::info!(
                            elapsed_ms = started.elapsed().as_millis(),
                            "Startup hosts repair removed TunnelDesk block"
                        ),
                        Ok(false) => tracing::info!(
                            elapsed_ms = started.elapsed().as_millis(),
                            "Startup hosts repair skipped; no TunnelDesk block"
                        ),
                        Err(error) => tracing::warn!(
                            elapsed_ms = started.elapsed().as_millis(),
                            "Failed to repair hosts on startup: {error}"
                        ),
                    }
                });
            }
            if settings.behavior.auto_start_profile {
                tauri::async_runtime::spawn(async move {
                    let state = startup_handle.state::<AppState>();
                    if let Err(error) = commands::start_profile_for_state(state.inner()).await {
                        tracing::error!("Failed to auto start profile: {error}");
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_settings,
            commands::save_settings,
            commands::set_launch_at_login,
            commands::load_profiles,
            commands::save_profiles,
            commands::save_tunnel_password,
            commands::delete_tunnel_password,
            commands::has_tunnel_password,
            commands::test_ssh,
            commands::start_profile,
            commands::stop_profile,
            commands::get_status,
            commands::test_service,
            commands::repair_hosts,
            commands::open_log_dir
        ])
        .build(tauri::generate_context!())
        .expect("failed to build TunnelDesk")
        .run(|_app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                tracing::info!("TunnelDesk exiting");
            }
        });
}

#[cfg(not(all(target_os = "linux", target_arch = "x86")))]
fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "打开 TunnelDesk", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let app_handle = app.handle().clone();
    let icon = app.default_window_icon().cloned();

    let mut builder = TrayIconBuilder::new().menu(&menu);
    if let Some(icon) = icon {
        builder = builder.icon(icon);
    }

    builder
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(move |_tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg(all(target_os = "linux", target_arch = "x86"))]
fn setup_tray(_app: &mut tauri::App) -> tauri::Result<()> {
    Ok(())
}

fn init_logging() {
    let logs_dir = config::logs_dir().unwrap_or_else(|_| std::env::temp_dir().join("TunnelDesk"));
    let file_appender = tracing_appender::rolling::daily(logs_dir, "tunneldesk.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
    std::mem::forget(guard);

    let subscriber = tracing_subscriber::fmt()
        .with_writer(non_blocking)
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .finish();

    let _ = tracing::subscriber::set_global_default(subscriber);
}
