use std::sync::Mutex;

use crate::tunnel::TunnelRuntime;

#[derive(Default)]
pub struct AppState {
    pub tunnel: Mutex<Option<TunnelRuntime>>,
}
