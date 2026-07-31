# cross-browser-native-messaging Specification

## Purpose

Define secure per-browser Native Messaging installation and identity handling for Chrome-family browsers, Microsoft Edge, and Firefox across supported desktop operating systems.

## Requirements

### Requirement: Setup writes browser-native host manifests

Panerelay setup SHALL write Chromium-compatible manifests with `allowed_origins` and Firefox-compatible manifests with `allowed_extensions` to the documented per-user locations for the selected operating system. Every manifest SHALL name the same loopback-scoped Bridge executable and SHALL authorize only configured Panerelay Extension identities.

#### Scenario: Setup runs on macOS or Linux

- **GIVEN** the user runs setup on macOS or Linux
- **WHEN** Native Messaging files are installed
- **THEN** Panerelay writes managed manifests to Chrome-family, Edge, and Firefox per-user discovery locations using the syntax required by each browser family

#### Scenario: Setup runs on Windows

- **GIVEN** the user runs setup on Windows
- **WHEN** Native Messaging files are installed
- **THEN** Panerelay writes distinct Chromium and Firefox manifests and registers their paths under Google Chrome, Microsoft Edge, and Mozilla per-user registry keys

### Requirement: Browser identities are validated and persisted

Panerelay SHALL preserve the existing validated Chromium Extension ID precedence, SHALL validate and persist one configured Firefox add-on ID, and SHALL let the Bridge accept only identities in the installed allowlist.

#### Scenario: Official identities are installed

- **GIVEN** setup receives no identity overrides
- **WHEN** it writes runtime and Native Messaging configuration
- **THEN** Chromium manifests authorize the official Chromium ID and Firefox manifests authorize the official Firefox add-on ID

#### Scenario: A custom identity is malformed

- **GIVEN** a supplied Chromium or Firefox identity violates its browser family's syntax constraints
- **WHEN** setup resolves installation identities
- **THEN** setup rejects the input before changing files or registry keys

### Requirement: Update and uninstall cover every managed browser

Panerelay SHALL update all managed browser manifests consistently and SHALL remove only Panerelay-managed manifests, registry entries, launchers, runtime state, and provider configuration during uninstall.

#### Scenario: Existing custom identities are updated

- **GIVEN** a prior installation persisted custom browser identities
- **WHEN** update runs without new identity overrides
- **THEN** Panerelay reuses the persisted identities across every rewritten manifest and Bridge allowlist

#### Scenario: Cross-browser integration is uninstalled

- **GIVEN** Panerelay installed Chrome, Edge, and Firefox Native Messaging entries
- **WHEN** the user confirms uninstall
- **THEN** every Panerelay-managed browser manifest and registry entry is removed without deleting unrelated browser or Agent data
