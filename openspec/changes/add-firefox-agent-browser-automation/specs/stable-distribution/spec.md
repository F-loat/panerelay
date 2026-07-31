## MODIFIED Requirements

### Requirement: Stable setup declares and diagnoses supported dependencies

Panerelay SHALL require Node.js 20 or newer, SHALL retain agent-browser 0.33.0 or newer as the Chromium automation floor, SHALL require a released agent-browser version with WebDriver browser-provider support for Firefox automation, SHALL report detected versions and browser-specific compatibility, and SHALL treat Qoder CLI as an optional Agent provider rather than a prerequisite for browser automation or Codex conversations.

#### Scenario: agent-browser is below the Chromium minimum

- **GIVEN** setup detects an agent-browser version older than 0.33.0
- **WHEN** the user runs doctor
- **THEN** the agent-browser check fails with an actionable upgrade instruction for every browser

#### Scenario: agent-browser lacks Firefox Provider support

- **GIVEN** agent-browser satisfies the Chromium minimum but its Provider contract is CDP-only
- **WHEN** the user runs doctor with Firefox connected
- **THEN** Chromium remains compatible
- **AND** Firefox automation reports the released WebDriver Provider version required for upgrade

#### Scenario: Optional Qoder runtime is absent

- **GIVEN** Native Messaging, agent-browser, and Codex are otherwise ready
- **WHEN** Qoder CLI is not installed or does not expose compatible ACP capabilities
- **THEN** doctor and the side panel report Qoder as unavailable without making the complete Panerelay installation unhealthy

## ADDED Requirements

### Requirement: Stable candidates prove browser-specific bundle isolation

Release validation SHALL build Chromium/Edge and Firefox Extension artifacts from separate platform entry graphs, retain machine-readable module ownership evidence, and reject an archive that contains the other platform's private adapter.

#### Scenario: Candidate contains isolated browser artifacts

- **GIVEN** a maintainer creates a stable or beta candidate
- **WHEN** release validation inspects both Extension archives
- **THEN** each archive contains the shared code and only its declared platform adapter graph
- **AND** both archives retain the same lockstep release identity

#### Scenario: Platform adapter leaks into the other artifact

- **GIVEN** the Firefox archive contains Chromium debugger code or the Chromium archive contains Firefox WebDriver rendezvous code
- **WHEN** release validation checks module ownership evidence and forbidden markers
- **THEN** candidate creation fails before checksums, upload, or publication

### Requirement: Firefox automation claims require real-runtime evidence

Panerelay SHALL classify deterministic WebDriver relay and Extension coverage separately from real Firefox automation evidence. A stable candidate SHALL NOT classify Firefox commands as Verified until the managed launcher, compatible agent-browser, authorization, representative commands, revocation, and cleanup pass on a supported real Firefox runtime.

#### Scenario: Only deterministic Firefox coverage exists

- **GIVEN** contract, bundle, setup, and relay tests pass without a real Firefox runtime
- **WHEN** compatibility documentation is generated or reviewed
- **THEN** Firefox automation remains Forwarded or Partial with the missing runtime evidence named

#### Scenario: Representative Firefox acceptance passes

- **GIVEN** a supported daily Firefox, compatible driver, and released agent-browser Provider version are available
- **WHEN** the bounded acceptance workflow passes startup, mapping, navigation, snapshot, input, tabs, screenshots, revocation, and cleanup
- **THEN** only those tested command groups may be classified as Verified for the recorded versions and platforms
