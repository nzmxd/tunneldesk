use std::fs;
use std::path::PathBuf;

use crate::error::AppResult;
use crate::model::{AppSettings, ProfilesFile, APP_NAME};

pub fn app_dir() -> AppResult<PathBuf> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| crate::error::AppError::Message(String::from("APPDATA is not set")))?;
    let dir = PathBuf::from(appdata).join(APP_NAME);
    fs::create_dir_all(&dir)?;
    fs::create_dir_all(dir.join("logs"))?;
    fs::create_dir_all(dir.join("backups"))?;
    Ok(dir)
}

pub fn settings_path() -> AppResult<PathBuf> {
    Ok(app_dir()?.join("settings.json"))
}

pub fn profiles_path() -> AppResult<PathBuf> {
    Ok(app_dir()?.join("profiles.json"))
}

pub fn logs_dir() -> AppResult<PathBuf> {
    Ok(app_dir()?.join("logs"))
}

pub fn backups_dir() -> AppResult<PathBuf> {
    Ok(app_dir()?.join("backups"))
}

pub fn load_settings() -> AppResult<AppSettings> {
    read_json_or_default(settings_path()?)
}

pub fn save_settings(settings: &AppSettings) -> AppResult<()> {
    write_json_atomic(settings_path()?, settings)
}

pub fn load_profiles() -> AppResult<ProfilesFile> {
    read_json_or_default(profiles_path()?)
}

pub fn save_profiles(profiles: &ProfilesFile) -> AppResult<()> {
    write_json_atomic(profiles_path()?, profiles)
}

fn read_json_or_default<T>(path: PathBuf) -> AppResult<T>
where
    T: serde::de::DeserializeOwned + serde::Serialize + Default,
{
    if !path.exists() {
        let value = T::default();
        write_json_atomic(path, &value)?;
        return Ok(value);
    }

    let content = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&content)?)
}

fn write_json_atomic<T>(path: PathBuf, value: &T) -> AppResult<()>
where
    T: serde::Serialize,
{
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(value)?;
    fs::write(&tmp, content)?;
    fs::rename(tmp, path)?;
    Ok(())
}
