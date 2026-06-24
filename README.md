# TunnelDesk

TunnelDesk is a Windows desktop tool for local development tunnels. It keeps application configs pointed at real service domains and ports, then transparently maps selected domains to local loopback addresses and forwards traffic through an SSH jump host.

## Status

This repository is an MVP scaffold with the main product flows in place:

- SSH settings and service profiles are saved under `%APPDATA%\TunnelDesk`.
- SSH passwords can be stored in Windows Credential Manager via `keyring`.
- Hosts entries are managed inside a dedicated `# BEGIN TUNNELDESK` block.
- Tunnel startup uses a Rust backend boundary so the frontend never receives secrets.

## Development

Prerequisites on Windows:

- Node.js 20+
- pnpm 9+
- Rust stable
- Visual Studio Build Tools with the Desktop development with C++ workload
- WebView2 Runtime

```powershell
pnpm install
pnpm tauri:dev
```

Run Rust checks:

```powershell
cd src-tauri
cargo fmt --all -- --check
cargo test
cargo clippy --all-targets --all-features
```

## Security Notes

- Passwords and private key passphrases are never written to JSON settings files.
- The frontend can save/delete/check secrets but cannot read secret values back.
- Hosts file writes are scoped to the TunnelDesk marker block only.
- The current MVP accepts SSH host keys on first connection. Production releases should pin and verify host key fingerprints.

## Configuration

Runtime files are created under `%APPDATA%\TunnelDesk`:

- `settings.json`: selected profile, SSH endpoint, non-secret behavior settings
- `profiles.json`: service profiles and loopback mappings
- `logs\`: rolling app logs
- `backups\`: hosts file backups before every write

Example service profiles live in `examples/service-profiles.example.json`. Real team profiles should be distributed out-of-band or imported through the UI, not committed with production hostnames.

## Operating Model

TunnelDesk does not enable TUN mode and does not change Clash, Mihomo, system proxy, browser proxy, or WinHTTP settings. It only:

1. writes selected service domains to a controlled hosts block;
2. listens on loopback addresses such as `127.77.0.10:3306`;
3. opens SSH `direct-tcpip` channels to the real service endpoints from the jump host network.

Applications keep using their original service domain and port.
