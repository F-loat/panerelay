## MODIFIED Requirements

### Requirement: Capability claims are evidence based

PaneRelay SHALL support agent-browser 0.33.0 or newer, SHALL treat 0.33.0 as the minimum supported
version and initial verified evidence baseline, and SHALL classify version-specific capability
groups as `Verified`, `Forwarded`, `Partial`, or `Unsupported`. PaneRelay SHALL require automated
and representative real-browser evidence before marking a capability group `Verified` for a
specific version.

#### Scenario: Installed version is below the minimum

- **GIVEN** agent-browser older than 0.33.0 is installed
- **WHEN** setup diagnostics evaluate the integration
- **THEN** PaneRelay reports the version as unsupported and instructs the user to upgrade

#### Scenario: Minimum version uses verified evidence

- **GIVEN** agent-browser 0.33.0 is installed
- **WHEN** the user reads compatibility guidance
- **THEN** PaneRelay links the 0.33.0 matrix and its `Verified`, `Forwarded`, `Partial`, and
  `Unsupported` classifications

#### Scenario: Newer compatible version is installed

- **GIVEN** agent-browser newer than 0.33.0 passes the Provider handshake
- **WHEN** PaneRelay reports its status
- **THEN** the version satisfies the minimum but does not inherit version-specific `Verified`
  claims without representative evidence

#### Scenario: Promote a capability to Verified

- **GIVEN** a capability currently appears as `Forwarded` or `Partial` for a tested version
- **WHEN** its contract tests and representative daily-Chrome scenario pass
- **THEN** the versioned compatibility matrix records it as `Verified` with its remaining
  limitations

#### Scenario: Browser-process ownership is required

- **GIVEN** an agent-browser command requires isolated contexts, launch flags, proxy
  configuration, Profile replay, `Browser.close`, or top-level request containment
- **WHEN** the Agent uses PaneRelay
- **THEN** the command remains `Unsupported` and fails explicitly without mutating the daily
  browser
