#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "linux")]
use std::path::{Path, PathBuf};
#[cfg(target_os = "windows")]
use std::process::Command;

use crate::error::{AppError, AppResult};
use crate::model::APP_NAME;

pub fn set_launch_at_login(enabled: bool) -> AppResult<()> {
    platform_set_launch_at_login(enabled)
}

pub fn launch_at_login_enabled() -> bool {
    platform_launch_at_login_enabled()
}

#[cfg(target_os = "windows")]
const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";

#[cfg(target_os = "windows")]
fn platform_set_launch_at_login(enabled: bool) -> AppResult<()> {
    if enabled {
        enable_windows_launch_at_login()
    } else {
        disable_windows_launch_at_login()
    }
}

#[cfg(target_os = "windows")]
fn platform_launch_at_login_enabled() -> bool {
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    let expected = exe.to_string_lossy().to_string();
    windows_registry_run_value()
        .map(|value| value.contains(&expected))
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn enable_windows_launch_at_login() -> AppResult<()> {
    let exe = std::env::current_exe()?;
    let value = format!("\"{}\"", exe.display());
    let output = Command::new("reg.exe")
        .args(["add", RUN_KEY, "/v", APP_NAME, "/t", "REG_SZ", "/d"])
        .arg(value)
        .arg("/f")
        .output()?;
    ensure_windows_reg_success(output)
}

#[cfg(target_os = "windows")]
fn disable_windows_launch_at_login() -> AppResult<()> {
    if windows_registry_run_value().is_none() {
        return Ok(());
    }
    let output = Command::new("reg.exe")
        .args(["delete", RUN_KEY, "/v", APP_NAME, "/f"])
        .output()?;
    ensure_windows_reg_success(output)
}

#[cfg(target_os = "windows")]
fn windows_registry_run_value() -> Option<String> {
    let output = Command::new("reg.exe")
        .args(["query", RUN_KEY, "/v", APP_NAME])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines().find_map(|line| {
        if !line.contains(APP_NAME) {
            return None;
        }
        let marker = "REG_SZ";
        let index = line.find(marker)?;
        Some(line[index + marker.len()..].trim().to_string())
    })
}

#[cfg(target_os = "windows")]
fn ensure_windows_reg_success(output: std::process::Output) -> AppResult<()> {
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let message = if stderr.is_empty() { stdout } else { stderr };
    Err(AppError::Message(if message.is_empty() {
        String::from("Failed to update Windows startup registry")
    } else {
        message
    }))
}

#[cfg(target_os = "linux")]
fn platform_set_launch_at_login(enabled: bool) -> AppResult<()> {
    let desktop_file = linux_autostart_file()?;
    if !enabled {
        if desktop_file.exists() {
            fs::remove_file(desktop_file)?;
        }
        return Ok(());
    }

    if let Some(parent) = desktop_file.parent() {
        fs::create_dir_all(parent)?;
    }
    let exe = std::env::current_exe()?;
    let content = format!(
        "[Desktop Entry]\nType=Application\nName={APP_NAME}\nExec={}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n",
        linux_desktop_exec(&exe)
    );
    fs::write(desktop_file, content)?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn platform_launch_at_login_enabled() -> bool {
    let Ok(desktop_file) = linux_autostart_file() else {
        return false;
    };
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    let expected = exe.to_string_lossy().to_string();
    fs::read_to_string(desktop_file)
        .map(|content| content.contains(&expected))
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
fn linux_autostart_file() -> AppResult<PathBuf> {
    let config_home = if let Ok(value) = std::env::var("XDG_CONFIG_HOME") {
        PathBuf::from(value)
    } else {
        let home = std::env::var("HOME")
            .map_err(|_| AppError::Message(String::from("HOME is not set")))?;
        PathBuf::from(home).join(".config")
    };
    Ok(config_home
        .join("autostart")
        .join(format!("{APP_NAME}.desktop")))
}

#[cfg(target_os = "linux")]
fn linux_desktop_exec(path: &Path) -> String {
    let escaped = path
        .to_string_lossy()
        .replace('\\', "\\\\")
        .replace('"', "\\\"");
    format!("\"{escaped}\"")
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn platform_set_launch_at_login(_enabled: bool) -> AppResult<()> {
    Err(AppError::Message(String::from(
        "Launch at login is not supported on this platform",
    )))
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn platform_launch_at_login_enabled() -> bool {
    false
}
