## Purpose

Define safe, user-scoped Chrome Native Messaging installation and lifecycle behavior for Panerelay on supported Windows systems.

## ADDED Requirements

### Requirement: Windows setup installs a launchable user-scoped Native Host

Panerelay SHALL install its bundled Native Host and a Windows launcher in user-owned state, write a valid Chrome Native Messaging manifest, and register that manifest under the current user's Chrome Native Messaging registry key.

#### Scenario: Fresh Windows setup

- **GIVEN** a supported Windows user can write Panerelay's user data and HKCU registry locations
- **WHEN** they run setup
- **THEN** Chrome can resolve the registered manifest and launch the bundled Host through its Windows launcher without administrator privileges

#### Scenario: Native Host paths contain spaces

- **GIVEN** Node.js or Panerelay is installed in a path containing spaces
- **WHEN** Chrome starts the registered Native Host
- **THEN** the launcher preserves the executable, Host path, and arguments exactly

### Requirement: Windows setup uses safe process and registry operations

Panerelay SHALL invoke Windows command wrappers and registry tools without interpolating user-controlled paths into an unquoted shell command, and SHALL keep allowed Extension origins explicit in the manifest.

#### Scenario: Registry path contains command metacharacters

- **GIVEN** a resolved user path contains characters meaningful to a command interpreter
- **WHEN** setup registers or removes the Native Host
- **THEN** Panerelay passes the registry key and manifest path as structured process arguments rather than executing them as shell syntax

#### Scenario: Unrecognized Extension connects

- **GIVEN** the manifest is installed on Windows
- **WHEN** an Extension origin not listed in `allowed_origins` attempts Native Messaging
- **THEN** Chrome and Panerelay do not grant it a Host connection

### Requirement: Windows setup configures launchable local tools

Panerelay SHALL discover Windows executable and command-wrapper forms for Node-based tools and write agent-browser Provider and Agent runtime configuration that can be spawned on Windows.

#### Scenario: npm installs command wrappers

- **GIVEN** agent-browser, Codex, or Qoder is exposed through a `.cmd` wrapper
- **WHEN** setup discovers and later launches that tool
- **THEN** Panerelay uses the Windows command interpreter safely and preserves the intended argument vector

#### Scenario: Tool is not executable on Windows

- **GIVEN** a candidate path exists but cannot complete its version or capability probe
- **WHEN** setup or doctor evaluates it
- **THEN** Panerelay rejects that candidate and reports an actionable unavailable status

### Requirement: Windows doctor verifies registry and manifest agreement

Panerelay SHALL verify that the current-user registry value points to the installed manifest and that the manifest names the installed launcher, expected Host name, and persisted effective Extension origin.

#### Scenario: Registry value is stale

- **GIVEN** the registry key points to a removed or different manifest
- **WHEN** the user runs doctor
- **THEN** the Native Messaging check fails and recommends rerunning setup

#### Scenario: Windows installation is internally consistent

- **GIVEN** the launcher, manifest, registry value, runtime config, and Provider config agree
- **WHEN** the user runs doctor
- **THEN** every Windows Native Messaging installation check passes without requiring Chrome to authorize a tab

#### Scenario: Windows manifest allows a different Extension ID

- **GIVEN** the registered Native Messaging manifest does not allow the configured effective Panerelay Extension origin
- **WHEN** the user runs doctor
- **THEN** the Native Messaging check fails and does not claim the Extension connection is ready

### Requirement: Windows update and uninstall are idempotent

Panerelay SHALL replace Panerelay-managed Windows artifacts on update and remove its current-user registry key, manifest, launcher, runtime config, and Provider config on uninstall without deleting unrelated user configuration.

#### Scenario: Setup is rerun

- **GIVEN** a prior Panerelay Windows installation exists
- **WHEN** the user runs update or setup again
- **THEN** managed artifacts point to the new matching version and no duplicate registry ownership is created

#### Scenario: Uninstall is rerun after partial cleanup

- **GIVEN** some managed files or the registry key are already absent
- **WHEN** the user runs uninstall
- **THEN** cleanup succeeds idempotently and leaves unrelated Native Messaging hosts untouched
