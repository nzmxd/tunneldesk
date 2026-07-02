# Changelog

## v0.1.11 - 2026-07-03

- Added service Profile creation, rename, and deletion from the Services page, with running-state guards and duplicate-name validation.
- Consolidated Profile actions into a compact selector overflow menu so import/export and CRUD controls no longer crowd the services toolbar.
- Added frontend tests and documentation for the expanded Profile management workflow.

## v0.1.10 - 2026-07-03

- Added service Profile import/export with previewed merges, missing tunnel mapping, pre-import `profiles.json` backups, and Profile switching in the services UI.
- Added Linux x64 RPM release packaging with the hosts helper and polkit policy included.

## v0.1.9 - 2026-07-01

- Fixed macOS release packaging so the updater metadata can include signed app archive artifacts alongside dmg installers.

## v0.1.8 - 2026-07-01

- Fixed Linux in-app updates for Debian package installs by publishing deb-specific updater metadata and signatures.
- Kept AppImage updater metadata explicit while preserving the existing Linux fallback.
- Improved the updater error message when the downloaded package format does not match the current install type.

## v0.1.7 - 2026-07-01

- Added Linux polkit-based hosts authorization so the GUI can run as a normal user on Ubuntu.
- Added a minimal `tunneldesk-hosts-helper` binary and Debian policy packaging for controlled `/etc/hosts` updates.
- Expanded diagnostics to show process privilege, hosts write capability, and Linux helper availability.

## v0.1.6 - 2026-06-30

- Unified the desktop, application, and tray icon set around the new TunnelDesk visual direction.
- Added single-instance behavior so reopening TunnelDesk focuses the existing window instead of launching another copy.
- Added close behavior preferences, including minimize-to-tray, exit, a close confirmation dialog, and a remember-choice option.

## v0.1.5 - 2026-06-30

- Reduced menu switching jank by deferring route navigation work and trimming the settings page component tree.
- Blocked the default webview context menu in the desktop app.
- Refreshed the desktop and tray icon set with a reproducible icon generation script.

## v0.1.4 - 2026-06-30

- Reduced startup work by deferring Windows launch-at-login checks, saved-password checks, and silent updater checks.
- Skipped redundant hosts rewrites and DNS flushes when the generated TunnelDesk hosts block is unchanged.
- Added staged timing logs for profile startup to make future launch bottlenecks easier to diagnose.

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
