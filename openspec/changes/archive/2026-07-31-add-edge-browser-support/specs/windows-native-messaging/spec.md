## MODIFIED Requirements

### Requirement: Windows setup installs a launchable user-scoped Native Host

Panerelay SHALL install its bundled Native Host and a Windows launcher in user-owned state, write a valid Chromium Native Messaging manifest, and register that manifest under the current user's Chrome and Microsoft Edge Native Messaging registry keys.

#### Scenario: Fresh Windows setup

- **GIVEN** a supported Windows user can write Panerelay's user data and HKCU registry locations
- **WHEN** they run setup
- **THEN** Chrome and Edge can resolve the registered manifest and launch the bundled Host through its Windows launcher without administrator privileges

#### Scenario: Native Host paths contain spaces

- **GIVEN** Node.js or Panerelay is installed in a path containing spaces
- **WHEN** Chrome or Edge starts the registered Native Host
- **THEN** the launcher preserves the executable, Host path, and arguments exactly

### Requirement: Windows setup uses safe process and registry operations

Panerelay SHALL invoke Windows command wrappers and registry tools without interpolating user-controlled paths into an unquoted shell command, SHALL manage exact Chrome and Edge current-user registry keys, and SHALL keep allowed Extension origins explicit in the manifest.

#### Scenario: Registry path contains command metacharacters

- **GIVEN** a resolved user path contains characters meaningful to a command interpreter
- **WHEN** setup registers or removes the Native Host for Chrome or Edge
- **THEN** Panerelay passes the registry key and manifest path as structured process arguments rather than executing them as shell syntax

#### Scenario: Unrecognized Extension connects

- **GIVEN** the manifest is installed on Windows
- **WHEN** an Extension origin not listed in `allowed_origins` attempts Native Messaging through Chrome or Edge
- **THEN** the browser and Panerelay do not grant it a Host connection

### Requirement: Windows doctor verifies registry and manifest agreement

Panerelay SHALL verify that the current-user Chrome and Edge registry values point to the installed manifest and that the manifest names the installed launcher, expected Host name, and persisted effective Extension origin.

#### Scenario: A browser registry value is stale

- **GIVEN** the Chrome or Edge registry key points to a removed or different manifest
- **WHEN** the user runs doctor
- **THEN** the corresponding Native Messaging check fails and recommends rerunning setup

#### Scenario: Windows installation is internally consistent

- **GIVEN** the launcher, manifest, both browser registry values, runtime config, and Provider config agree
- **WHEN** the user runs doctor
- **THEN** every Windows Native Messaging installation check passes without requiring Chrome or Edge to authorize a tab

#### Scenario: Windows manifest allows a different Extension ID

- **GIVEN** the registered Native Messaging manifest does not allow the configured effective Panerelay Extension origin
- **WHEN** the user runs doctor
- **THEN** both browser integrations fail validation and do not claim the Extension connection is ready

### Requirement: Windows update and uninstall are idempotent

Panerelay SHALL replace Panerelay-managed Windows artifacts on update and remove its current-user Chrome and Edge registry keys, manifest, launcher, runtime config, and Provider config on uninstall without deleting unrelated user configuration.

#### Scenario: Setup is rerun

- **GIVEN** a prior Panerelay Windows installation exists
- **WHEN** the user runs update or setup again
- **THEN** managed artifacts and both browser keys point to the new matching version and no duplicate registry ownership is created

#### Scenario: Uninstall is rerun after partial cleanup

- **GIVEN** some managed files or either browser registry key are already absent
- **WHEN** the user runs uninstall
- **THEN** cleanup succeeds idempotently and leaves unrelated Native Messaging hosts untouched
