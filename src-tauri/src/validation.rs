use std::collections::HashSet;
use std::net::IpAddr;

use crate::error::{AppError, AppResult};
use crate::model::{AppSettings, AuthMethod, ProfilesFile, ServiceProfile, SshSettings};

pub fn validate_settings(settings: &AppSettings) -> AppResult<()> {
    validate_ssh(&settings.ssh)
}

pub fn validate_ssh(ssh: &SshSettings) -> AppResult<()> {
    if ssh.host.trim().is_empty() {
        return Err(AppError::Message(String::from("SSH host is required")));
    }
    if ssh.username.trim().is_empty() {
        return Err(AppError::Message(String::from("SSH username is required")));
    }
    if ssh.port == 0 {
        return Err(AppError::Message(String::from(
            "SSH port must be between 1 and 65535",
        )));
    }
    if ssh.server_alive_interval < 5 {
        return Err(AppError::Message(String::from(
            "ServerAliveInterval must be at least 5 seconds",
        )));
    }
    if ssh.server_alive_count_max == 0 {
        return Err(AppError::Message(String::from(
            "ServerAliveCountMax must be at least 1",
        )));
    }
    if ssh.auth_method == AuthMethod::PrivateKey && ssh.identity_file.trim().is_empty() {
        return Err(AppError::Message(String::from(
            "Identity file is required for private key authentication",
        )));
    }
    Ok(())
}

pub fn validate_profiles(file: &ProfilesFile) -> AppResult<()> {
    if file.profiles.is_empty() {
        return Err(AppError::Message(String::from(
            "At least one profile is required",
        )));
    }

    let mut profile_ids = HashSet::new();
    for profile in &file.profiles {
        validate_profile(profile)?;
        if !profile_ids.insert(profile.id.trim().to_string()) {
            return Err(AppError::Message(format!(
                "Duplicate profile id: {}",
                profile.id
            )));
        }
    }
    Ok(())
}

fn validate_profile(profile: &ServiceProfile) -> AppResult<()> {
    if profile.id.trim().is_empty() {
        return Err(AppError::Message(String::from("Profile id is required")));
    }
    if profile.name.trim().is_empty() {
        return Err(AppError::Message(String::from("Profile name is required")));
    }

    let mut service_ids = HashSet::new();
    let mut listeners = HashSet::new();

    for service in &profile.services {
        if service.id.trim().is_empty() {
            return Err(AppError::Message(String::from("Service id is required")));
        }
        if !service_ids.insert(service.id.trim().to_string()) {
            return Err(AppError::Message(format!(
                "Duplicate service id in profile {}: {}",
                profile.name, service.id
            )));
        }
        if service.name.trim().is_empty() {
            return Err(AppError::Message(format!(
                "Service name is required for {}",
                service.id
            )));
        }
        if service.domain.trim().is_empty() {
            return Err(AppError::Message(format!(
                "Service domain is required for {}",
                service.name
            )));
        }
        if service.port == 0 {
            return Err(AppError::Message(format!(
                "Service port must be between 1 and 65535: {}",
                service.name
            )));
        }

        let local_ip: IpAddr = service.local_ip.parse().map_err(|_| {
            AppError::Message(format!(
                "Local IP must be a valid loopback address: {}",
                service.local_ip
            ))
        })?;
        if !local_ip.is_loopback() {
            return Err(AppError::Message(format!(
                "Local IP must be loopback for {}: {}",
                service.name, service.local_ip
            )));
        }

        let listener = format!("{}:{}", service.local_ip, service.port);
        if !listeners.insert(listener.clone()) {
            return Err(AppError::Message(format!(
                "Duplicate local listener in profile {}: {}",
                profile.name, listener
            )));
        }
    }

    Ok(())
}
