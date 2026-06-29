use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use crate::hosts;
use crate::model::{ServiceConfig, ServiceState, ServiceStatus};

pub fn service_status(service: &ServiceConfig) -> ServiceStatus {
    if !service.enabled {
        return ServiceStatus {
            service_id: service.id.clone(),
            state: ServiceState::Disabled,
            message: String::from("Disabled"),
        };
    }

    let addr = format!("{}:{}", service.local_ip, service.port);
    let socket_addr = match addr
        .to_socket_addrs()
        .ok()
        .and_then(|mut addrs| addrs.next())
    {
        Some(addr) => addr,
        None => {
            return ServiceStatus {
                service_id: service.id.clone(),
                state: ServiceState::Error,
                message: String::from("Invalid local address"),
            };
        }
    };

    match TcpStream::connect_timeout(&socket_addr, Duration::from_millis(300)) {
        Ok(_) => ServiceStatus {
            service_id: service.id.clone(),
            state: ServiceState::Healthy,
            message: String::from("Local listener is reachable"),
        },
        Err(error) => ServiceStatus {
            service_id: service.id.clone(),
            state: ServiceState::Stopped,
            message: error.to_string(),
        },
    }
}

pub fn is_admin() -> bool {
    hosts::can_write_hosts()
}
