## Purpose

Define how an optional Panerelay adapter connects supported Browser Use CLI and Browser Harness workflows to explicitly authorized tabs in the user's existing Chromium browser without changing Browser Use automation semantics or unrelated configuration.

## ADDED Requirements

### Requirement: Setup installs the Browser Use integration only when requested

Panerelay setup SHALL install and register the Browser Use adapter, its Panerelay Skill, private runtime configuration, and diagnostics only when the user selects the Browser Use integration. Setup SHALL preserve Browser Use's own configuration, official Skill, executable installation, default daemon, and shell `PATH`, and uninstall SHALL remove only Panerelay-owned Browser Use artifacts.

#### Scenario: User selects Browser Use during setup

- **GIVEN** a supported Browser Use installation is available
- **WHEN** the user asks Panerelay setup to enable Browser Use
- **THEN** setup installs a durable Panerelay CLI adapter artifact and the Panerelay Browser Use Skill
- **AND** it registers the adapter by an exact protected path
- **AND** it does not overwrite Browser Use configuration, its official Skill, or another Panerelay integration

#### Scenario: Browser Use is absent or incompatible

- **GIVEN** the user selects the Browser Use integration
- **WHEN** setup cannot find the pinned compatible Browser Use and Browser Harness versions
- **THEN** setup and doctor report the missing or incompatible dependency with bounded remediation guidance
- **AND** they do not silently install, upgrade, or downgrade Browser Use
- **AND** the Native Host and unrelated integrations remain usable

#### Scenario: User uninstalls the Browser Use integration

- **GIVEN** Panerelay previously installed the Browser Use adapter and Skill
- **WHEN** the user removes that integration
- **THEN** setup removes the adapter registration, Panerelay-owned Skill, configuration, and private runtime artifacts
- **AND** it leaves Browser Use, its configuration, and its official Skill unchanged
- **AND** if private runtime state existed, setup reports that a detached daemon and participant may remain until user release or Extension/Native Host disconnection

### Requirement: Panerelay supports reversible default and one-run connection selection

The integration SHALL store a Direct or Panerelay Extension connection preference in Panerelay-owned configuration. An explicit one-run selection SHALL override that preference only for the invoked Browser Use operation and SHALL NOT mutate the saved preference, Browser Use configuration, or an already running daemon in the other lane.

#### Scenario: Saved mode is Panerelay Extension

- **GIVEN** the Panerelay Browser Use preference selects the Extension connection
- **WHEN** the installed Skill starts Browser Use without an explicit override
- **THEN** the Panerelay CLI resolves the registered Browser Use adapter
- **AND** Browser Use receives only the Panerelay-owned runtime name, runtime directory, and current CDP bootstrap URL

#### Scenario: Saved mode is Direct

- **GIVEN** the saved preference selects Direct
- **WHEN** the installed Skill starts Browser Use without an explicit override
- **THEN** Browser Use uses its normal direct connection behavior
- **AND** the CLI bypasses Panerelay browser selection and reads no Bridge connection credentials
- **AND** no Panerelay CDP ticket, participant, or Extension authorization is created

#### Scenario: One run overrides the saved mode

- **GIVEN** either connection mode is saved as the default
- **WHEN** the caller explicitly selects the other mode for one invocation
- **THEN** only that invocation uses the selected lane
- **AND** the saved preference and any healthy daemon in the other lane remain unchanged

### Requirement: Extension mode uses an isolated persistent Browser Harness lane

The Browser Use adapter SHALL assign a Panerelay-owned Browser Harness runtime directory and stable daemon name that cannot collide with the user's default Browser Harness lane. The Panerelay lane SHALL start lazily, SHALL reuse one healthy daemon and virtual CDP participant across sequential calls, and SHALL NOT stop them merely because one Skill command finishes.

#### Scenario: First Panerelay Browser Use command starts the lane

- **GIVEN** no healthy Panerelay Browser Harness daemon exists
- **WHEN** Browser Use consumes the current Panerelay CDP bootstrap URL
- **THEN** Browser Harness starts in the private Panerelay runtime
- **AND** the Bridge creates one Browser Use participant and accepts its virtual CDP WebSocket

#### Scenario: Sequential command reuses the lane

- **GIVEN** the Panerelay Browser Harness daemon and virtual CDP WebSocket remain healthy
- **WHEN** a later Skill command resolves another short-lived bootstrap URL
- **THEN** Browser Harness reuses its existing daemon and WebSocket
- **AND** the unused bootstrap ticket expires without creating another participant

#### Scenario: Simultaneous commands contend for the shared lane

- **GIVEN** a Browser Use command is currently using the persistent Panerelay lane
- **WHEN** another command attempts simultaneous adapter execution
- **THEN** the adapter's `browser-use:panerelay` concurrency key serializes the invocation for at most 750 milliseconds or fails it deterministically with `busy`
- **AND** it does not create a second daemon or silently claim task isolation

#### Scenario: Independent Agents interleave sequential commands

- **GIVEN** multiple Agents use the same persistent Panerelay Browser Harness lane
- **WHEN** their commands are not simultaneous but interleave over time
- **THEN** the integration documents that Browser Harness tab, page-session, and event state is shared
- **AND** it does not claim that those Agent tasks are isolated from one another

### Requirement: Native Host and transport loss bound the persistent connection

Normal task completion SHALL NOT release the persistent Browser Use participant. Extension revocation, authorization loss, virtual CDP WebSocket closure, heartbeat expiry, or Native Host shutdown SHALL invalidate the participant, detach its targets, and make the existing Browser Harness daemon unhealthy. A later command SHALL obtain a bootstrap URL for the current Native Host generation and SHALL either recover by restarting the stale daemon or fail with actionable diagnostics.

#### Scenario: User revokes authorization

- **GIVEN** Browser Use controls one or more explicitly authorized targets
- **WHEN** the user revokes the tab or site authorization in the Extension
- **THEN** the Bridge closes the Browser Use virtual CDP connection and detaches every target owned by that participant
- **AND** later Browser Use commands cannot regain access without current user authorization

#### Scenario: Native Host exits

- **GIVEN** the persistent Browser Use lane is connected
- **WHEN** the Native Messaging Host shuts down or the Extension disconnects it
- **THEN** the Bridge invalidates the bootstrap generation, participant, lease state, and target sessions
- **AND** the detached Browser Harness process cannot continue controlling the browser through its stale URL

#### Scenario: Next command encounters a stale daemon

- **GIVEN** a Browser Harness daemon process remains after its virtual CDP transport failed
- **WHEN** the next Panerelay Browser Use command runs with a fresh bootstrap URL
- **THEN** Browser Harness health checking restarts or replaces the unhealthy daemon before using the new URL
- **OR** the integration fails explicitly without falling back to an unauthorized Direct connection

### Requirement: Browser Use retains automation semantics within Panerelay boundaries

The adapter and Panerelay CLI SHALL provide connection material only. Browser Use and Browser Harness SHALL remain responsible for helpers, CDP command sequencing, tab selection, page state, and Agent behavior. The Bridge SHALL expose only explicitly authorized opaque targets, SHALL require a current control lease for mutation, and SHALL return explicit CDP errors for unsupported browser-process operations or authorization violations.

#### Scenario: Browser Use initializes against virtual CDP

- **GIVEN** at least one eligible target is explicitly authorized
- **WHEN** the pinned Browser Harness daemon resolves `/json/version`, connects to the returned WebSocket, discovers targets, and attaches with flattened sessions
- **THEN** the Bridge returns compatible browser and target metadata for the authorized target set
- **AND** Browser Use can enable its supported page domains without Chrome Remote Debugging being enabled

#### Scenario: Browser Use requests an unsupported browser operation

- **GIVEN** Browser Use is connected through the Extension-backed lane
- **WHEN** it sends a CDP command that requires browser-process ownership, an isolated browser context, whole-browser shutdown, or access outside the authorized target set
- **THEN** the Bridge returns an explicit protocol error
- **AND** the adapter does not emulate, downgrade, or reroute the operation through Direct Chrome

#### Scenario: Browser focus changes

- **GIVEN** a Panerelay Browser Use participant is connected
- **WHEN** the user or Browser Use changes the visible browser focus
- **THEN** focus alone neither grants authorization nor selects a different browser registration

#### Scenario: Browser Use sends Input to a background target

- **GIVEN** Browser Use selected an authorized target without foregrounding its Chrome tab or window
- **WHEN** it sends the first supported `Input.*` command for the current target attachment
- **THEN** Panerelay serializes target-scoped focus-emulation setup before forwarding the unchanged Input command
- **AND** the setup does not activate the tab, focus the window, grant authority, or emulate input with page JavaScript
- **AND** the setup is invalidated with the owning target and participant lifecycle

#### Scenario: Browser Use discovers a cross-site iframe

- **GIVEN** an authorized top-level target contains an out-of-process iframe
- **WHEN** Chrome reports the iframe through non-pausing flattened auto-attach and Browser Harness polls browser-level `Target.getTargets`
- **THEN** the Bridge includes an opaque participant-local iframe target owned by that authorized top-level target
- **AND** flattened `Target.attachToTarget` returns a participant-local session backed by the Chrome child session
- **AND** later commands and events are translated without exposing raw Chrome target or session identifiers

#### Scenario: An iframe child leaves the authorized lifecycle

- **GIVEN** one or more participants have virtual sessions for an auto-attached iframe child
- **WHEN** the child detaches, the top-level target detaches, a participant closes, authorization is revoked, or the Extension or Native Host disconnects
- **THEN** Panerelay invalidates every affected participant-local child target and session
- **AND** later commands fail explicitly instead of reaching another child or participant

### Requirement: Compatibility claims are pinned and scoped

The first release SHALL validate Browser Use 0.13.7 and Browser Harness 0.1.8 for the CLI, installed Skill, and Browser Harness-backed CLI MCP surface. It SHALL record each tested capability as Verified, Forwarded, Partial, or Unsupported and SHALL keep Python SDK transparency outside the release claim. Existing agent-browser 0.33.0 compatibility groups SHALL remain regression gates.

#### Scenario: Release candidate is evaluated

- **GIVEN** the adapter implementation and bounded spike are complete
- **WHEN** Panerelay evaluates a release candidate
- **THEN** compatibility evidence covers bootstrap, core operations, tab creation and closure, popup and iframe behavior, revocation, Native Host reload, stale-daemon recovery, simultaneous invocation handling, and persistent reuse
- **AND** the record identifies the exact Browser Use, Browser Harness, Chromium, and Panerelay versions

#### Scenario: Python SDK runs without an explicit Panerelay session

- **GIVEN** application code constructs a Browser Use Agent or BrowserSession without passing Panerelay connection material
- **WHEN** that code runs outside the installed CLI/Skill integration
- **THEN** Panerelay does not claim or attempt transparent interception
- **AND** the application follows Browser Use's native SDK connection behavior
