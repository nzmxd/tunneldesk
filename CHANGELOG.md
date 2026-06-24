# Changelog

## v0.1.0 - 2026-06-24

- First formal TunnelDesk release.
- Fixed Linux x86 packaging by disabling the tray icon for that target and avoiding unavailable Ubuntu 22.04 i386 AppIndicator packages.
- Fixed macOS packaging by adding the required Tauri icon assets.
- Fixed macOS log directory opening by using the platform `open` command.
