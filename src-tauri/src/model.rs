use serde::{Deserialize, Serialize};

pub const APP_NAME: &str = "TunnelDesk";
pub const DEFAULT_PROFILE_ID: &str = "default";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AuthMethod {
    Password,
    PrivateKey,
    Agent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshSettings {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    pub identity_file: String,
    pub password_credential_key: String,
    pub key_passphrase_credential_key: String,
    pub server_alive_interval: u64,
    pub server_alive_count_max: u8,
}

impl Default for SshSettings {
    fn default() -> Self {
        Self {
            host: String::new(),
            port: 22,
            username: String::new(),
            auth_method: AuthMethod::Password,
            identity_file: String::new(),
            password_credential_key: String::new(),
            key_passphrase_credential_key: String::new(),
            server_alive_interval: 30,
            server_alive_count_max: 3,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorSettings {
    pub start_minimized: bool,
    pub auto_repair_on_start: bool,
    pub cleanup_on_exit: bool,
}

impl Default for BehaviorSettings {
    fn default() -> Self {
        Self {
            start_minimized: false,
            auto_repair_on_start: false,
            cleanup_on_exit: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub schema_version: u32,
    pub current_profile_id: String,
    pub ssh: SshSettings,
    pub behavior: BehaviorSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            current_profile_id: String::from(DEFAULT_PROFILE_ID),
            ssh: SshSettings::default(),
            behavior: BehaviorSettings::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceConfig {
    pub id: String,
    pub name: String,
    pub domain: String,
    pub port: u16,
    pub local_ip: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceProfile {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub services: Vec<ServiceConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilesFile {
    pub schema_version: u32,
    pub profiles: Vec<ServiceProfile>,
}

impl Default for ProfilesFile {
    fn default() -> Self {
        Self {
            schema_version: 1,
            profiles: vec![ServiceProfile {
                id: String::from(DEFAULT_PROFILE_ID),
                name: String::from("Default Profile"),
                enabled: true,
                services: Vec::new(),
            }],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ServiceState {
    Disabled,
    Stopped,
    Checking,
    Healthy,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceStatus {
    pub service_id: String,
    pub state: ServiceState,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    pub running: bool,
    pub current_profile_id: String,
    pub is_admin: bool,
    pub hosts_block_present: bool,
    pub message: String,
    pub services: Vec<ServiceStatus>,
}

impl Default for AppStatus {
    fn default() -> Self {
        Self {
            running: false,
            current_profile_id: String::from(DEFAULT_PROFILE_ID),
            is_admin: false,
            hosts_block_present: false,
            message: String::from("Stopped"),
            services: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretPayload {
    pub key: String,
    pub value: String,
}
