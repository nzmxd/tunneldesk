use keyring::Entry;

use crate::error::{AppError, AppResult};

const SERVICE_NAME: &str = "TunnelDesk";

pub fn save_secret(key: &str, value: &str) -> AppResult<()> {
    let entry =
        Entry::new(SERVICE_NAME, key).map_err(|error| AppError::Credential(error.to_string()))?;
    entry
        .set_password(value)
        .map_err(|error| AppError::Credential(error.to_string()))
}

pub fn get_secret(key: &str) -> AppResult<String> {
    let entry =
        Entry::new(SERVICE_NAME, key).map_err(|error| AppError::Credential(error.to_string()))?;
    entry
        .get_password()
        .map_err(|error| AppError::Credential(error.to_string()))
}

pub fn delete_secret(key: &str) -> AppResult<()> {
    let entry =
        Entry::new(SERVICE_NAME, key).map_err(|error| AppError::Credential(error.to_string()))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(error) => {
            let message = error.to_string();
            if message.to_ascii_lowercase().contains("not found") {
                Ok(())
            } else {
                Err(AppError::Credential(message))
            }
        }
    }
}

pub fn has_secret(key: &str) -> bool {
    get_secret(key).is_ok()
}
