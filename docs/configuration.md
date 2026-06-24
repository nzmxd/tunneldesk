# Configuration

TunnelDesk keeps repository defaults generic. Real SSH and service details are user data.

## SSH Settings

Saved in `%APPDATA%\TunnelDesk\settings.json`:

```json
{
  "schemaVersion": 1,
  "currentProfileId": "default",
  "ssh": {
    "host": "jump.example.com",
    "port": 22,
    "username": "developer",
    "authMethod": "password",
    "identityFile": "",
    "passwordCredentialKey": "TunnelDesk:ssh:jump.example.com:22:developer:password",
    "keyPassphraseCredentialKey": "",
    "serverAliveInterval": 30,
    "serverAliveCountMax": 3
  },
  "behavior": {
    "startMinimized": false,
    "autoRepairOnStart": false,
    "cleanupOnExit": true
  }
}
```

The password value itself is stored in Windows Credential Manager.

## Service Profiles

Saved in `%APPDATA%\TunnelDesk\profiles.json`:

```json
{
  "schemaVersion": 1,
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

TunnelDesk then listens on `127.77.0.10:3306` and forwards the traffic through SSH to `mysql.example.internal:3306`.
