# playwright-cdp-connection Specification

## Purpose

Let Playwright CLI and compatible Playwright clients use explicitly authorized tabs in an existing Chromium browser through Panerelay, while retaining the Bridge's authentication, target routing, control lease, and revocation guarantees.

## Requirements

### Requirement: Playwright has a dedicated discovery gateway

Panerelay SHALL expose a loopback-only Playwright CDP discovery gateway separate from the Browser Use gateway. The gateway SHALL resolve a selected live CDP-capable browser into a short-lived, participant-scoped standard CDP endpoint without exposing Bridge bearer credentials or changing Browser Use lane behavior.

#### Scenario: Playwright resolves a ready browser

- **GIVEN** the Native Host has a live CDP-capable browser registration
- **WHEN** a Playwright client connects through the configured Panerelay Playwright endpoint
- **THEN** it receives standard CDP version metadata and a participant-scoped WebSocket URL
- **AND** the connection is assigned the Playwright engine identity and its own lane
- **AND** Browser Use's participant and daemon state remain independent

#### Scenario: No authorized browser is ready

- **GIVEN** no selected browser is registered, CDP relay is unavailable, or the registration generation changed
- **WHEN** a Playwright client requests discovery
- **THEN** the gateway returns an explicit bounded failure
- **AND** it does not create a participant, target attachment, or browser authorization

### Requirement: Playwright sees only exposed authorized targets

The Playwright CDP connection SHALL expose only the opaque Panerelay targets available to its participant under the current site permission, tab authorization, browser selection, and control-lease policy. It MUST NOT expose raw Chrome tab IDs or unrelated tabs.

#### Scenario: Client lists tabs

- **GIVEN** the user authorized a subset of existing supported web tabs
- **WHEN** the client runs `tab-list`
- **THEN** Playwright lists only the corresponding exposed tabs with stable-in-session Playwright tab indexes
- **AND** the list does not grant access to an independently opened or unauthorized tab

#### Scenario: Client selects a tab

- **GIVEN** Playwright has listed more than one exposed target
- **WHEN** the client runs `tab-select` for one listed index
- **THEN** subsequent snapshots and page actions address that target
- **AND** Chrome's user-visible focused tab and window do not change solely because of logical selection

### Requirement: Playwright actions use the existing relay policy

Playwright page actions, snapshots, screenshots, navigation, input, dialogs, frames, and supported target lifecycle operations SHALL pass through the shared CDP relay and SHALL be subject to the current control lease and target serialization. Unsupported browser-process ownership features MUST fail explicitly.

#### Scenario: Client performs a supported page action

- **GIVEN** the selected target is authorized and the participant holds a current control lease
- **WHEN** Playwright runs a supported navigation or page mutation
- **THEN** the action reaches the selected authorized tab
- **AND** the Bridge preserves the existing activity, serialization, and control visibility behavior

#### Scenario: Client requests an unsupported browser-owned feature

- **GIVEN** Playwright requests an isolated context, launch-time proxy or executable option, browser-wide close, or top-level containment guarantee
- **WHEN** the Bridge evaluates the request
- **THEN** it returns an explicit unsupported or ownership error
- **AND** it does not emulate success or mutate the user's browser process

### Requirement: Controlled documents identify Playwright activity

When a Playwright participant performs a document-touching control action, the Extension SHALL apply a distinct Playwright controlled favicon with the shared green control badge. Passive target setup, allowlisted reads, screenshots, and target discovery SHALL NOT apply the favicon. Navigation, refresh, target detach, participant release, and authorization revocation SHALL restore the page-owned favicon when the document remains available. Favicon rendering and restoration SHALL be asynchronous, best-effort presentation work and MUST NOT delay, fail, or alter CDP commands, target detach, participant release, or authorization revocation.

#### Scenario: Playwright mutates a document

- **GIVEN** a Playwright participant sends a document-touching command to an authorized target
- **WHEN** the command enters controlled execution
- **THEN** the target document displays the Playwright controlled favicon and green badge
- **AND** it does not display the agent-browser or Browser Use favicon

#### Scenario: Playwright performs a passive operation

- **GIVEN** a Playwright participant performs target setup, an allowlisted read, or a screenshot
- **WHEN** the command completes
- **THEN** the page-owned favicon remains unchanged

#### Scenario: Playwright control ends

- **GIVEN** a target document has a Playwright controlled favicon
- **WHEN** the document navigates, the target detaches, the participant releases, or authorization is revoked
- **THEN** the Extension restores the favicon captured from that document when restoration is possible

#### Scenario: Favicon presentation fails or stalls

- **GIVEN** applying or restoring the controlled favicon fails or does not settle promptly
- **WHEN** a CDP command completes or control cleanup proceeds
- **THEN** the command result, target detach, participant release, and authorization revocation remain independent of the favicon task

### Requirement: Playwright cleanup and revocation are deterministic

Playwright participant disconnect, explicit detach, Browser Use coexistence, Extension authorization loss, Bridge shutdown, and Native Host generation changes SHALL release only the relevant Playwright participant while preserving unrelated participants, and SHALL eventually detach targets when no authorized participant remains.

#### Scenario: Playwright detaches while Browser Use remains connected

- **GIVEN** Browser Use and Playwright hold independent participants for the same browser
- **WHEN** Playwright detaches
- **THEN** only the Playwright participant and its participant-local sessions are released
- **AND** Browser Use remains connected
- **AND** target attachments remain only while another participant references them

#### Scenario: User revokes authorization

- **GIVEN** a Playwright participant or pending ticket exists for an authorized browser
- **WHEN** the user revokes the relevant tab or browser authorization
- **THEN** the Playwright ticket, participant, WebSocket, and affected target attachments are invalidated
- **AND** later Playwright commands fail closed

### Requirement: Playwright configuration is opt-in and explicit

Panerelay SHALL provide an optional Playwright CLI integration that exposes a stable loopback discovery endpoint for explicit Playwright configuration or one-run attach. Panerelay SHALL NOT set Playwright as a user-level default, modify shell startup files, shadow the upstream `playwright-cli` command, or change agent-browser or Browser Use defaults.

#### Scenario: User explicitly configures the Playwright endpoint

- **GIVEN** the user has installed the optional Playwright CLI integration
- **WHEN** they configure `browser.cdpEndpoint` or `PLAYWRIGHT_MCP_CDP_ENDPOINT` with the Panerelay Playwright endpoint, or pass it to `attach --cdp`
- **THEN** the explicit Playwright CLI session uses that endpoint
- **AND** the endpoint remains loopback-only and subject to normal Panerelay authorization

#### Scenario: User omits the Playwright integration

- **GIVEN** the user runs base Panerelay setup without selecting Playwright
- **WHEN** setup completes
- **THEN** it does not install or register Playwright support and does not modify Playwright, agent-browser, or Browser Use configuration
