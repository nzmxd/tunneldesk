use std::io::{self, ErrorKind};
use std::net::{IpAddr, SocketAddr};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use russh::client;
use ssh_key::PublicKey;
use tokio::io::copy_bidirectional;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, Mutex};
use tokio::task::JoinHandle;
use tokio::time::{sleep, Instant};
use tracing::{error, info, warn};

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
    ssh: Arc<SshSessionManager>,
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
        self.ssh.stop().await;
    }
}

type SshHandle = Arc<client::Handle<ClientHandler>>;

struct SshSessionManager {
    settings: SshSettings,
    password: Option<String>,
    current: Mutex<Option<SshHandle>>,
    stopped: AtomicBool,
}

impl SshSessionManager {
    async fn new(settings: SshSettings, password: Option<String>) -> AppResult<Self> {
        let handle = Arc::new(connect_and_authenticate(&settings, password.clone()).await?);
        Ok(Self {
            settings,
            password,
            current: Mutex::new(Some(handle)),
            stopped: AtomicBool::new(false),
        })
    }

    async fn current_handle(&self) -> AppResult<SshHandle> {
        if self.is_stopped() {
            return Err(AppError::Message(String::from("Tunnel is stopped")));
        }

        let mut guard = self.current.lock().await;
        if self.is_stopped() {
            return Err(AppError::Message(String::from("Tunnel is stopped")));
        }

        if let Some(handle) = guard.as_ref() {
            if !handle.is_closed() {
                return Ok(Arc::clone(handle));
            }

            info!("SSH session is closed; reconnecting");
            *guard = None;
        }

        let handle = self.reconnect_locked().await?;
        *guard = Some(Arc::clone(&handle));
        Ok(handle)
    }

    async fn mark_stale(&self, observed: &SshHandle, reason: &str) {
        let mut guard = self.current.lock().await;
        let is_current = guard
            .as_ref()
            .map(|current| Arc::ptr_eq(current, observed))
            .unwrap_or(false);

        if is_current {
            info!(reason = %reason, "Marking SSH session stale");
            *guard = None;
        }
    }

    async fn stop(&self) {
        self.stopped.store(true, Ordering::SeqCst);
        let handle = { self.current.lock().await.take() };
        if let Some(handle) = handle {
            let _ = handle
                .disconnect(russh::Disconnect::ByApplication, "TunnelDesk stopped", "")
                .await;
        }
    }

    async fn reconnect_locked(&self) -> AppResult<SshHandle> {
        let mut attempt = 0_u32;

        loop {
            if self.is_stopped() {
                return Err(AppError::Message(String::from("Tunnel is stopped")));
            }

            attempt += 1;
            match connect_and_authenticate(&self.settings, self.password.clone()).await {
                Ok(handle) => {
                    if self.is_stopped() {
                        let _ = handle
                            .disconnect(russh::Disconnect::ByApplication, "TunnelDesk stopped", "")
                            .await;
                        return Err(AppError::Message(String::from("Tunnel is stopped")));
                    }

                    info!(attempt, "SSH reconnect succeeded");
                    return Ok(Arc::new(handle));
                }
                Err(error) => {
                    let delay = reconnect_delay(attempt);
                    warn!(
                        attempt,
                        retry_in_seconds = delay.as_secs(),
                        error = %error,
                        "SSH reconnect failed; retrying"
                    );
                    self.wait_for_retry_delay(delay).await;
                }
            }
        }
    }

    async fn wait_for_retry_delay(&self, delay: Duration) {
        let started = Instant::now();
        let poll_interval = Duration::from_millis(250);

        while !self.is_stopped() {
            let elapsed = started.elapsed();
            if elapsed >= delay {
                break;
            }

            let remaining = delay.saturating_sub(elapsed);
            let sleep_for = if remaining < poll_interval {
                remaining
            } else {
                poll_interval
            };
            sleep(sleep_for).await;
        }
    }

    fn is_stopped(&self) -> bool {
        self.stopped.load(Ordering::SeqCst)
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

    let mut listeners = Vec::new();
    for service in enabled_services {
        let listener = bind_local_listener(&service).await?;
        listeners.push((service, listener));
    }

    let ssh_manager = Arc::new(SshSessionManager::new(tunnel.ssh.clone(), password).await?);
    let (stop_tx, _) = broadcast::channel(1);
    let mut listener_tasks = Vec::new();

    for (service, listener) in listeners {
        let ssh = Arc::clone(&ssh_manager);
        let mut stop_rx = stop_tx.subscribe();

        let task = tokio::spawn(async move {
            let service_name = service.name.clone();
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
        ssh: ssh_manager,
    })
}

async fn bind_local_listener(service: &ServiceConfig) -> AppResult<TcpListener> {
    let socket_addr = service_socket_addr(service)?;
    TcpListener::bind(socket_addr).await.map_err(|error| {
        error!(
            service_id = %service.id,
            service_name = %service.name,
            listener = %socket_addr,
            raw_os_error = ?error.raw_os_error(),
            error = %error,
            "Failed to bind local listener"
        );
        listener_bind_error(service, &socket_addr.to_string(), error)
    })
}

fn service_socket_addr(service: &ServiceConfig) -> AppResult<SocketAddr> {
    let local_ip = service.local_ip.parse::<IpAddr>().map_err(|_| {
        AppError::Message(format!(
            "Local IP must be a valid loopback address for {}: {}",
            service.name, service.local_ip
        ))
    })?;
    Ok(SocketAddr::new(local_ip, service.port))
}

fn listener_bind_error(service: &ServiceConfig, address: &str, error: io::Error) -> AppError {
    let prefix = format!(
        "Cannot start local listener for service \"{}\" on {address}: {error}",
        service.name
    );
    let message = match error.kind() {
        ErrorKind::AddrInUse => format!(
            "{prefix}. Another process is already using that listener, or a wildcard listener is using TCP port {}.",
            service.port
        ),
        ErrorKind::AddrNotAvailable => format!(
            "{prefix}. The local IP is not available on this machine. Use a loopback address such as 127.77.0.10."
        ),
        ErrorKind::PermissionDenied => format!("{prefix}. {}", listener_permission_hint(service.port)),
        _ if is_windows_socket_permission_error(&error) => {
            format!("{prefix}. {}", listener_permission_hint(service.port))
        }
        _ => prefix,
    };

    AppError::Message(message)
}

fn is_windows_socket_permission_error(error: &io::Error) -> bool {
    error.raw_os_error() == Some(10013)
}

fn listener_permission_hint(port: u16) -> String {
    format!(
        "Windows denied this socket (WSAEACCES/os error 10013). This often means TCP port {port} is in an excluded/reserved range created by Hyper-V, WSL, Docker, VPN, or endpoint security. Check with: netsh interface ipv4 show excludedportrange protocol=tcp"
    )
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
    ssh: Arc<SshSessionManager>,
    service: ServiceConfig,
) -> AppResult<()> {
    let originator = inbound
        .peer_addr()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|_| String::from("127.0.0.1"));
    let (handle, channel) = open_forward_channel(&ssh, &service, &originator).await?;
    let mut outbound = channel.into_stream();
    match copy_bidirectional(&mut inbound, &mut outbound).await {
        Ok(_) => Ok(()),
        Err(error) => {
            if should_reconnect_io_error(&error) {
                ssh.mark_stale(&handle, &error.to_string()).await;
            }
            Err(AppError::Io(error))
        }
    }
}

async fn open_forward_channel(
    ssh: &SshSessionManager,
    service: &ServiceConfig,
    originator: &str,
) -> AppResult<(SshHandle, russh::Channel<client::Msg>)> {
    let handle = ssh.current_handle().await?;
    match open_forward_channel_once(&handle, service, originator).await {
        Ok(channel) => Ok((handle, channel)),
        Err(error) if should_reconnect_ssh_error(&error) => {
            warn!(
                service_id = %service.id,
                service_name = %service.name,
                error = %error,
                "SSH channel open failed on current session; reconnecting"
            );
            ssh.mark_stale(&handle, &error.to_string()).await;

            let handle = ssh.current_handle().await?;
            match open_forward_channel_once(&handle, service, originator).await {
                Ok(channel) => Ok((handle, channel)),
                Err(error) => {
                    if should_reconnect_ssh_error(&error) {
                        ssh.mark_stale(&handle, &error.to_string()).await;
                    }
                    Err(AppError::Ssh(error.to_string()))
                }
            }
        }
        Err(error) => Err(AppError::Ssh(error.to_string())),
    }
}

async fn open_forward_channel_once(
    handle: &client::Handle<ClientHandler>,
    service: &ServiceConfig,
    originator: &str,
) -> Result<russh::Channel<client::Msg>, russh::Error> {
    handle
        .channel_open_direct_tcpip(
            service.domain.clone(),
            u32::from(service.port),
            originator.to_string(),
            0,
        )
        .await
}

fn should_reconnect_ssh_error(error: &russh::Error) -> bool {
    match error {
        russh::Error::Disconnect
        | russh::Error::HUP
        | russh::Error::ConnectionTimeout
        | russh::Error::KeepaliveTimeout
        | russh::Error::InactivityTimeout
        | russh::Error::SendError => true,
        russh::Error::IO(error) => should_reconnect_io_error(error),
        russh::Error::ChannelOpenFailure(_) => false,
        _ => false,
    }
}

fn should_reconnect_io_error(error: &io::Error) -> bool {
    matches!(
        error.kind(),
        ErrorKind::BrokenPipe
            | ErrorKind::ConnectionAborted
            | ErrorKind::ConnectionReset
            | ErrorKind::TimedOut
            | ErrorKind::UnexpectedEof
    )
}

fn reconnect_delay(attempt: u32) -> Duration {
    let exponent = attempt.saturating_sub(1).min(5);
    Duration::from_secs((1_u64 << exponent).min(30))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn service() -> ServiceConfig {
        ServiceConfig {
            id: String::from("mysql"),
            name: String::from("MySQL"),
            group: String::new(),
            domain: String::from("mysql.example.internal"),
            remark: String::new(),
            port: 3306,
            local_ip: String::from("127.77.0.10"),
            tunnel_id: String::from("default"),
            sort_order: 10,
            enabled: true,
        }
    }

    #[test]
    fn service_socket_addr_uses_configured_local_listener() {
        let addr = service_socket_addr(&service()).expect("service address should parse");

        assert_eq!(addr.to_string(), "127.77.0.10:3306");
    }

    #[test]
    fn windows_socket_permission_error_mentions_excluded_port_check() {
        let error = io::Error::from_raw_os_error(10013);

        let message = listener_bind_error(&service(), "127.77.0.10:3306", error).to_string();

        assert!(message.contains("MySQL"));
        assert!(message.contains("127.77.0.10:3306"));
        assert!(message.contains("os error 10013"));
        assert!(message.contains("netsh interface ipv4 show excludedportrange"));
    }

    #[test]
    fn ssh_session_errors_trigger_reconnect() {
        assert!(should_reconnect_ssh_error(&russh::Error::SendError));
        assert!(should_reconnect_ssh_error(&russh::Error::Disconnect));
        assert!(should_reconnect_ssh_error(&russh::Error::KeepaliveTimeout));
    }

    #[test]
    fn channel_open_failures_do_not_trigger_reconnect() {
        let connect_failed =
            russh::Error::ChannelOpenFailure(russh::ChannelOpenFailure::ConnectFailed);
        let administratively_prohibited =
            russh::Error::ChannelOpenFailure(russh::ChannelOpenFailure::AdministrativelyProhibited);

        assert!(!should_reconnect_ssh_error(&connect_failed));
        assert!(!should_reconnect_ssh_error(&administratively_prohibited));
    }

    #[test]
    fn reconnect_delay_caps_at_thirty_seconds() {
        assert_eq!(reconnect_delay(1), Duration::from_secs(1));
        assert_eq!(reconnect_delay(2), Duration::from_secs(2));
        assert_eq!(reconnect_delay(10), Duration::from_secs(30));
    }
}
