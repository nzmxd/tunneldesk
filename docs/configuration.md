# Configuration

TunnelDesk keeps repository defaults generic. Real SSH, tunnel, service, and behavior data live under the per-user data directory:

- Windows: `%APPDATA%\TunnelDesk`
- Linux: `$XDG_DATA_HOME/TunnelDesk` or `~/.local/share/TunnelDesk`
- macOS: `~/Library/Application Support/TunnelDesk`

## App Settings

Saved in `settings.json` inside that data directory:

```json
{
  "schemaVersion": 2,
  "currentProfileId": "default",
  "currentTunnelId": "default",
  "tunnels": [
    {
      "id": "default",
      "name": "Default Tunnel",
      "enabled": true,
      "ssh": {
        "host": "jump.example.com",
        "port": 22,
        "username": "developer",
        "authMethod": "password",
        "identityFile": "",
        "passwordCredentialKey": "TunnelDesk:tunnel:default:password",
        "keyPassphraseCredentialKey": "",
        "serverAliveInterval": 30,
        "serverAliveCountMax": 3
      }
    }
  ],
  "behavior": {
    "startMinimized": false,
    "autoStartProfile": false,
    "launchAtLogin": false,
    "autoRepairOnStart": false,
    "cleanupOnExit": true,
    "themeMode": "system"
  }
}
```

`themeMode` accepts `system`, `light`, or `dark`. `autoStartProfile` starts the current profile after the app opens. `launchAtLogin` mirrors the platform login startup entry. The password value itself is not saved here.

## Password Storage

SSH passwords are stored in the platform keyring through the Rust backend. This follows the same broad pattern used by desktop SSH managers such as Xshell and SecureCRT: session metadata is stored separately from secret values, and the UI never reads saved passwords back.

TunnelDesk derives password keys itself using:

```text
TunnelDesk:tunnel:{tunnelId}:password
```

The frontend only sends `tunnelId` plus a new password value to `save_tunnel_password`. It cannot choose arbitrary credential keys, cannot export saved password values, and cannot request a saved password value. Settings exports contain only tunnel metadata and the credential reference.

The platform keyring protects stored values with the current user account boundary. This is not a replacement for securing the OS account, disk, backups, and malware boundary.

## Service Profiles

Saved in `profiles.json` inside the data directory:

```json
{
  "schemaVersion": 2,
  "profiles": [
    {
      "id": "default",
      "name": "Default Profile",
      "enabled": true,
      "services": [
        {
          "id": "example-mysql",
          "name": "Example MySQL",
          "domain": "mysql.example.internal",
          "port": 3306,
          "localIp": "127.77.0.10",
          "tunnelId": "default",
          "enabled": true
        }
      ]
    }
  ]
}
```

Each enabled service gets one hosts line:

```text
127.77.0.10 mysql.example.internal
```

TunnelDesk then listens on `127.77.0.10:3306` and forwards traffic through the selected tunnel to `mysql.example.internal:3306`.
