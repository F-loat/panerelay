## MODIFIED Requirements

### Requirement: Update and uninstall cover every managed browser

Panerelay SHALL update all managed browser manifests and the opt-in Firefox automation launcher consistently and SHALL remove only Panerelay-managed manifests, registry entries, launchers, runtime state, and provider configuration during uninstall.

#### Scenario: Existing custom identities are updated

- **GIVEN** a prior installation persisted custom browser identities
- **WHEN** update runs without new identity overrides
- **THEN** Panerelay reuses the persisted identities across every rewritten manifest and Bridge allowlist

#### Scenario: Firefox launcher is updated

- **GIVEN** setup previously installed the Panerelay Firefox launcher
- **WHEN** a matching Panerelay update runs
- **THEN** setup replaces only that managed launcher and preserves the user's browser profiles and normal Firefox shortcuts

#### Scenario: Cross-browser integration is uninstalled

- **GIVEN** Panerelay installed Chrome, Edge, and Firefox Native Messaging entries plus a Firefox automation launcher
- **WHEN** the user confirms uninstall
- **THEN** every Panerelay-managed browser manifest, registry entry, launcher, and runtime file is removed without deleting unrelated browser, profile, or Agent data

## ADDED Requirements

### Requirement: Setup manages an explicit Firefox automation launcher

Panerelay setup SHALL install a per-user launcher that starts the user's selected Firefox executable and profile with the minimum supported automation flag. The launcher SHALL remain separate from normal Firefox shortcuts and SHALL reject unsafe, conflicting, or browser-process-wide arguments.

#### Scenario: Setup installs Firefox automation support

- **GIVEN** a supported Firefox executable and required driver are available
- **WHEN** the user runs Panerelay setup
- **THEN** setup installs a user-owned launcher and records only validated executable, profile selection, and local transport configuration
- **AND** it does not start or close Firefox

#### Scenario: User supplies unsafe launcher arguments

- **GIVEN** launcher input attempts to enable system access, a non-loopback remote endpoint, a conflicting profile, or an unvalidated executable
- **WHEN** setup or the launcher validates the request
- **THEN** it rejects the request before starting Firefox or changing persisted runtime configuration

### Requirement: Native Host reports Firefox automation readiness

The Native Host SHALL report launcher, Firefox process, driver, and relay readiness separately from Native Messaging connectivity and SHALL not infer automation authorization from any of them.

#### Scenario: Native Messaging works without Firefox automation

- **GIVEN** the Firefox Extension is connected to the Native Host from a normally started browser
- **WHEN** it requests readiness
- **THEN** Native Messaging and collaboration report ready while automation reports a launcher restart requirement

#### Scenario: Driver exits after readiness

- **GIVEN** the managed Firefox process and driver were ready
- **WHEN** the driver exits or its health check fails
- **THEN** the Native Host reports automation unavailable and the Bridge revokes the affected automation sessions
