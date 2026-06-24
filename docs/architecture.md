# Architecture

TunnelDesk avoids global proxy interception. It uses scoped hosts mappings and local TCP listeners.

```text
Application -> real.service.domain:port
            -> hosts maps domain to 127.77.x.x
            -> TunnelDesk listens on 127.77.x.x:port
            -> SSH direct-tcpip through the jump host
            -> real.service.domain:port from the jump host network
```

This keeps existing proxy software untouched and lets applications keep their original service configuration.

## Components

- `config`: JSON settings and profile persistence.
- `credential`: OS credential store wrapper.
- `hosts`: Windows hosts marker block management.
- `tunnel`: local listeners and SSH `direct-tcpip` forwarding.
- `health`: status and diagnostics.
- `validation`: backend-side settings and profile validation.

## Runtime Data

TunnelDesk stores all mutable user data in `%APPDATA%\TunnelDesk` so the repository stays generic:

- `settings.json` contains the SSH host, port, username, selected profile, and non-secret behavior flags.
- `profiles.json` contains user-managed service mappings.
- secrets are stored in Windows Credential Manager through `keyring`.
- hosts backups are created in `%APPDATA%\TunnelDesk\backups` before every hosts write.

## Privilege Boundary

Editing `C:\Windows\System32\drivers\etc\hosts` requires administrator privileges. The app should be launched elevated for start/repair operations. Normal configuration editing can run without elevation.

## Validation

The Rust backend rejects invalid configuration at command boundaries:

- SSH host and username are required.
- SSH and service ports must be non-zero.
- service local IPs must be loopback addresses.
- service listener pairs must not duplicate within a profile.
- profile and service ids must be unique.

## Known MVP Limits

- Password authentication is implemented first. Private key and ssh-agent modes are visible in the UI as planned extension points.
- SSH host keys are currently accepted by policy. A production release should store fingerprints and warn on changes.
