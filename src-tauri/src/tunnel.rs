use std::sync::Arc;
use std::time::Duration;

use russh::client;
use ssh_key::PublicKey;
use tokio::io::copy_bidirectional;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use tokio::task::JoinHandle;
use tracing::{error, info};

use crate::error::{AppError, AppResult};
use crate::model::{AuthMethod, ServiceConfig, SshSettings, TunnelConfig};

#[derive(Clone)]
struct ClientHandler;

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(&mut self, _: &PublicKey) -> Result<bool, Self::Error> {
        // MVP policy: accept the presented key. A later version should persist and compare
        // fingerprints before authentication.
        Ok(true)
    }
}

pub struct TunnelRuntime {
    tunnel_id: String,
    stop_tx: broadcast::Sender<()>,
    listener_tasks: Vec<JoinHandle<()>>,
    ssh: Arc<client::Handle<ClientHandler>>,
}

impl TunnelRuntime {
    pub fn tunnel_id(&self) -> &str {
        &self.tunnel_id
    }

    pub async fn stop(self) {
        let _ = self.stop_tx.send(());
        for task in self.listener_tasks {
            task.abort();
        }
        let _ = self
            .ssh
            .disconnect(russh::Disconnect::ByApplication, "TunnelDesk stopped", "")
            .await;
    }
}

pub async fn test_ssh(settings: &SshSettings, password: Option<String>) -> AppResult<()> {
    let handle = connect_and_authenticate(settings, password).await?;
    handle
        .disconnect(
            russh::Disconnect::ByApplication,
            "TunnelDesk test finished",
            "",
        )
        .await
        .map_err(|error| AppError::Ssh(error.to_string()))?;
    Ok(())
}

pub async fn start(
    tunnel: TunnelConfig,
    services: Vec<ServiceConfig>,
    password: Option<String>,
) -> AppResult<TunnelRuntime> {
    let enabled_services = services
        .into_iter()
        .filter(|service| service.enabled)
        .collect::<Vec<_>>();
    if enabled_services.is_empty() {
        return Err(AppError::Message(String::from(
            "No enabled services in profile",
        )));
    }

    let handle = Arc::new(connect_and_authenticate(&tunnel.ssh, password).await?);
    let (stop_tx, _) = broadcast::channel(1);
    let mut listener_tasks = Vec::new();

    for service in enabled_services {
        let listener = TcpListener::bind(format!("{}:{}", service.local_ip, service.port)).await?;
        let ssh = Arc::clone(&handle);
        let mut stop_rx = stop_tx.subscribe();
        let service_name = service.name.clone();

        let task = tokio::spawn(async move {
            info!(
                "listening for {} on {}:{}",
                service.name, service.local_ip, service.port
            );
            loop {
                tokio::select! {
                    _ = stop_rx.recv() => {
                        info!("stopping listener for {service_name}");
                        break;
                    }
                    accepted = listener.accept() => {
                        match accepted {
                            Ok((stream, _)) => {
                                let ssh = Arc::clone(&ssh);
                                let service = service.clone();
                                tokio::spawn(async move {
                                    if let Err(error) = forward_connection(stream, ssh, service).await {
                                        error!("forwarding failed: {error}");
                                    }
                                });
                            }
                            Err(error) => {
                                error!("listener accept failed: {error}");
                                break;
                            }
                        }
                    }
                }
            }
        });
        listener_tasks.push(task);
    }

    Ok(TunnelRuntime {
        tunnel_id: tunnel.id,
        stop_tx,
        listener_tasks,
        ssh: handle,
    })
}

async fn connect_and_authenticate(
    settings: &SshSettings,
    password: Option<String>,
) -> AppResult<client::Handle<ClientHandler>> {
    let config = client::Config {
        keepalive_interval: Some(Duration::from_secs(settings.server_alive_interval)),
        keepalive_max: settings.server_alive_count_max as usize,
        ..Default::default()
    };

    let addr = format!("{}:{}", settings.host, settings.port);
    let mut handle = client::connect(Arc::new(config), addr, ClientHandler)
        .await
        .map_err(|error| AppError::Ssh(error.to_string()))?;

    match settings.auth_method {
        AuthMethod::Password => {
            let password = password.ok_or_else(|| {
                AppError::Credential(String::from(
                    "SSH password is not saved in Credential Manager",
                ))
            })?;
            let result = handle
                .authenticate_password(settings.username.clone(), password)
                .await
                .map_err(|error| AppError::Ssh(error.to_string()))?;
            if !result.success() {
                return Err(AppError::Ssh(String::from(
                    "SSH password authentication failed",
                )));
            }
        }
        AuthMethod::PrivateKey => {
            return Err(AppError::Ssh(String::from(
                "Private key authentication is reserved in the UI but not implemented in this MVP",
            )));
        }
        AuthMethod::Agent => {
            return Err(AppError::Ssh(String::from(
                "ssh-agent authentication is reserved in the UI but not implemented in this MVP",
            )));
        }
    }

    Ok(handle)
}

async fn forward_connection(
    mut inbound: TcpStream,
    ssh: Arc<client::Handle<ClientHandler>>,
    service: ServiceConfig,
) -> AppResult<()> {
    let originator = inbound
        .peer_addr()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|_| String::from("127.0.0.1"));
    let channel = ssh
        .channel_open_direct_tcpip(
            service.domain.clone(),
            u32::from(service.port),
            originator,
            0,
        )
        .await
        .map_err(|error| AppError::Ssh(error.to_string()))?;
    let mut outbound = channel.into_stream();
    copy_bidirectional(&mut inbound, &mut outbound).await?;
    Ok(())
}
