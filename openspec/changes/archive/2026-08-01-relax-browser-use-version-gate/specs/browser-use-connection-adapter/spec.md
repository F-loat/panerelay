## MODIFIED Requirements

### Requirement: Setup installs the Browser Use integration only when requested

Panerelay setup SHALL install and register the Browser Use adapter, its Panerelay Skill, private runtime configuration, and diagnostics only when the user selects the Browser Use integration. Setup SHALL preserve Browser Use's own configuration, official Skill, executable installation, default daemon, and shell `PATH`, and uninstall SHALL remove only Panerelay-owned Browser Use artifacts. User-facing setup, doctor, Skill, and package documentation SHALL present Browser Use as the single product prerequisite and SHALL NOT require the user to install or manage its internal Browser Harness runtime separately.

#### Scenario: User selects Browser Use during setup

- **GIVEN** a supported Browser Use installation is available
- **WHEN** the user asks Panerelay setup to enable Browser Use
- **THEN** setup installs a durable Panerelay CLI adapter artifact and the Panerelay Browser Use Skill
- **AND** it registers the adapter by an exact protected path
- **AND** it does not overwrite Browser Use configuration, its official Skill, or another Panerelay integration

#### Scenario: Browser Use is absent or below the minimum

- **GIVEN** the user selects the Browser Use integration
- **WHEN** setup cannot find Browser Use 0.13.7 or newer
- **THEN** setup and doctor report one missing or incompatible Browser Use dependency with bounded remediation guidance
- **AND** they do not silently install, upgrade, or downgrade Browser Use
- **AND** the Native Host and unrelated integrations remain usable

#### Scenario: Browser Use internal runtime is incomplete

- **GIVEN** Browser Use 0.13.7 or newer is installed
- **WHEN** its internal Browser Harness runtime is missing or older than 0.1.8
- **THEN** setup and doctor fail the single Browser Use installation check
- **AND** user-facing remediation asks the user to repair or upgrade Browser Use without exposing Browser Harness as a separately managed product
- **AND** the Native Host and unrelated integrations remain usable

#### Scenario: User uninstalls the Browser Use integration

- **GIVEN** Panerelay previously installed the Browser Use adapter and Skill
- **WHEN** the user removes that integration
- **THEN** setup removes the adapter registration, Panerelay-owned Skill, configuration, and private runtime artifacts
- **AND** it leaves Browser Use, its configuration, and its official Skill unchanged
- **AND** if private runtime state existed, setup reports that a detached daemon and participant may remain until user release or Extension/Native Host disconnection

### Requirement: Compatibility claims are pinned and scoped

The integration SHALL accept Browser Use stable releases at or above 0.13.7 when their internal Browser Harness runtime is at or above 0.1.8. Panerelay SHALL retain Browser Use 0.13.7 with Browser Harness 0.1.8 as the exact verified baseline for the CLI, installed Skill, and Browser Use CLI MCP surface; passing the minimum gate SHALL NOT automatically classify a newer pair as Verified. Compatibility records SHALL classify tested capabilities as Verified, Forwarded, Partial, or Unsupported, and SHALL keep Python SDK transparency outside the release claim. Existing agent-browser 0.33.0 compatibility groups SHALL remain regression gates.

#### Scenario: Exact verified baseline is evaluated

- **GIVEN** the adapter implementation and bounded spike use Browser Use 0.13.7 with Browser Harness 0.1.8
- **WHEN** Panerelay evaluates a release candidate
- **THEN** compatibility evidence covers bootstrap, core operations, tab creation and closure, popup and iframe behavior, revocation, Native Host reload, stale-daemon recovery, simultaneous invocation handling, and persistent reuse
- **AND** the record identifies the exact Browser Use, Browser Harness, Chromium, and Panerelay versions

#### Scenario: Newer stable installation passes the minimum gate

- **GIVEN** Browser Use is newer than 0.13.7 and its internal Browser Harness runtime is at least 0.1.8
- **WHEN** setup or doctor evaluates the installation
- **THEN** the Browser Use compatibility check passes
- **AND** Panerelay does not represent that untested version pair as Verified

#### Scenario: Installed version is below a minimum

- **GIVEN** Browser Use is older than 0.13.7 or its internal Browser Harness runtime is older than 0.1.8
- **WHEN** setup or doctor evaluates the installation
- **THEN** the single Browser Use compatibility check fails closed
- **AND** user-facing guidance identifies Browser Use 0.13.7 or newer as the supported prerequisite

#### Scenario: Python SDK runs without an explicit Panerelay session

- **GIVEN** application code constructs a Browser Use Agent or BrowserSession without passing Panerelay connection material
- **WHEN** that code runs outside the installed CLI/Skill integration
- **THEN** Panerelay does not claim or attempt transparent interception
- **AND** the application follows Browser Use's native SDK connection behavior
