## Purpose

Define how PaneRelay exposes advanced agent-browser commands through explicitly authorized daily-Chrome targets while preserving honest browser-ownership boundaries, privacy, revocation, and version-specific verification.

## ADDED Requirements

### Requirement: Advanced commands remain target scoped

PaneRelay SHALL execute advanced page, network, storage, emulation, accessibility, and diagnostic commands only through the selected authorized target or one of its flattened child sessions.

#### Scenario: Advanced command on an authorized target

- **GIVEN** an Agent holds the active PaneRelay lease and selected an authorized HTTP(S) target
- **WHEN** agent-browser sends an advanced page-scoped CDP command
- **THEN** PaneRelay forwards the command only to that target and returns the correlated result

#### Scenario: Unrelated daily-browser target

- **GIVEN** all-tabs authorization exposes multiple eligible targets
- **WHEN** the Agent runs a diagnostic or network command on the selected target
- **THEN** PaneRelay does not attach, read events from, or return data belonging only to an unrelated target

### Requirement: State commands preserve user intent and privacy

PaneRelay SHALL support agent-browser cookie and web-storage commands only as explicit Agent actions on the selected authorized target, and SHALL NOT log returned values by default.

#### Scenario: Read and update fixture state

- **GIVEN** a local authorized fixture is selected
- **WHEN** the Agent sets, reads, and removes a test cookie or storage key
- **THEN** agent-browser observes the expected state without affecting unrelated origins

#### Scenario: Authorization is revoked during state access

- **GIVEN** a state command is pending on a controlled target
- **WHEN** the user revokes target or browser authorization
- **THEN** PaneRelay fails the command and does not retain or replay its result

### Requirement: Network diagnostics are observable and reversible

PaneRelay SHALL support target-scoped request details, HAR capture, extra headers, offline emulation, credentials, and Fetch routing when the underlying Chrome target provides the required page-scoped CDP methods.

#### Scenario: Capture local fixture traffic

- **GIVEN** HAR or request diagnostics are enabled on an authorized local fixture
- **WHEN** the fixture makes a test request
- **THEN** agent-browser records the request and its expected non-sensitive response data for that target

#### Scenario: Remove a request route

- **GIVEN** the Agent installed a Fetch route on the selected target
- **WHEN** the Agent removes that route or closes the relay session
- **THEN** subsequent requests are no longer modified by the route

### Requirement: Page and diagnostic artifacts survive the relay

PaneRelay SHALL transport successful PDF, screenshot, accessibility, trace, profiler, and screencast results without truncation when Chrome exposes them through the authorized target.

#### Scenario: Generate a page artifact

- **GIVEN** an authorized local fixture and a requested output path owned by the local agent-browser process
- **WHEN** the Agent captures a PDF, accessibility report, trace, profile, or recording
- **THEN** the command completes with a readable non-empty artifact or structured result

#### Scenario: Large CDP payload

- **GIVEN** a successful artifact result exceeds one Native Messaging frame
- **WHEN** PaneRelay transports the result
- **THEN** the receiver reconstructs the complete payload with integrity verification

### Requirement: File interactions use local Agent paths

PaneRelay SHALL treat upload and download paths as local agent-browser concerns and SHALL NOT expose local filesystem access to the Extension.

#### Scenario: Upload a fixture file

- **GIVEN** the selected fixture contains a file input and the Agent provides an explicit local test file
- **WHEN** agent-browser uploads the file
- **THEN** the page observes the selected file metadata without the Extension reading the file contents

#### Scenario: Download behavior is unavailable

- **GIVEN** a download command requires browser-wide behavior that Chrome does not expose through the authorized target
- **WHEN** agent-browser requests that behavior
- **THEN** PaneRelay returns an explicit unsupported error instead of reporting a successful download

### Requirement: Emulation remains page scoped

PaneRelay SHALL support target-scoped viewport, media, locale, timezone, user-agent, and network emulation when Chrome exposes the corresponding page command, without resizing or relaunching the user's Chrome process.

#### Scenario: Apply page emulation

- **GIVEN** an authorized local fixture is selected
- **WHEN** the Agent applies viewport, media, or offline emulation
- **THEN** the selected page reports the requested emulated state and unrelated targets remain unchanged

#### Scenario: Browser-level permission grant is required

- **GIVEN** a command requires a browser-wide permission grant or process-level configuration
- **WHEN** the Agent requests the command through PaneRelay
- **THEN** PaneRelay returns an explicit unsupported error

### Requirement: Capability claims are evidence based

PaneRelay SHALL classify agent-browser 0.33.0 capability groups as `Verified`, `Forwarded`, `Partial`, or `Unsupported`, and SHALL require automated and real-browser evidence before marking a group `Verified`.

#### Scenario: Promote a capability to Verified

- **GIVEN** a capability currently appears as `Forwarded` or `Partial`
- **WHEN** its contract tests and representative daily-Chrome scenario pass
- **THEN** the versioned compatibility matrix records it as `Verified` with its remaining limitations

#### Scenario: Browser-process ownership is required

- **GIVEN** an agent-browser command requires isolated contexts, launch flags, proxy configuration, Profile replay, `Browser.close`, or top-level request containment
- **WHEN** the Agent uses PaneRelay
- **THEN** the command remains `Unsupported` and fails explicitly without mutating the daily browser
