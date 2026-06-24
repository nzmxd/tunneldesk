mod commands;
mod config;
mod credential;
mod error;
mod health;
mod hosts;
mod model;
mod state;
mod tunnel;
mod validation;

use state::AppState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, RunEvent};

pub fn run() {
    init_logging();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Open TunnelDesk", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let app_handle = app.handle().clone();

            TrayIconBuilder::new()
                .menu(&menu)
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
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_settings,
            commands::save_settings,
            commands::load_profiles,
            commands::save_profiles,
            commands::save_secret,
            commands::delete_secret,
            commands::has_secret,
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
