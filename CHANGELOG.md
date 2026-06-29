# Changelog

## v0.1.3 - 2026-06-29

- Added Cargo dependency fetch retries to make release packaging resilient to transient crates.io network resets.

## v0.1.2 - 2026-06-29

- Added signed in-app update checks and install flow.
- Added a top bar update button that appears when a newer release is available.
- Added a manual update check entry in settings.
- Updated release packaging to publish updater metadata and signatures.

## v0.1.0 - 2026-06-24

- First formal TunnelDesk release.
- Adjusted Linux x86 CI packaging to avoid unavailable Ubuntu 22.04 i386 AppIndicator packages; Linux x86 remains experimental and is not part of formal releases yet.
- Fixed macOS packaging by adding the required Tauri icon assets.
- Fixed macOS log directory opening by using the platform `open` command.
