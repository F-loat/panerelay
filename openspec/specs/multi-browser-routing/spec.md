# multi-browser-routing Specification

## Purpose

Define how Panerelay discovers multiple browser installations, selects exactly one for each agent-browser session, and preserves browser-local authorization and ownership.

## Requirements

### Requirement: Browser registrations remain independent

Panerelay SHALL retain a separate live registration for every connected supported browser installation, identified by an opaque browser registration ID, without one browser overwriting another browser's discovery state.

#### Scenario: Chrome and Edge are connected

- **GIVEN** supported Panerelay Extensions and Native Hosts are running in Chrome and Edge
- **WHEN** both browsers register with the local integration
- **THEN** Panerelay reports both registrations as independently available
- **AND** each registration retains its own browser family, capabilities, endpoint, credential, process ownership, and liveness

#### Scenario: One registered browser exits

- **GIVEN** Chrome and Edge both have live registrations
- **WHEN** the Chrome-owned Native Host exits
- **THEN** only Chrome's registration becomes unavailable
- **AND** Edge's registration and active sessions remain unchanged

### Requirement: New sessions use deterministic browser selection

Panerelay SHALL select a browser for a new agent-browser participant in this order: an explicit invocation selector, the saved user default, or the single live CDP-ready registration. Panerelay SHALL fail closed when no candidate is ready or when an implicit or family-level choice is ambiguous.

#### Scenario: Invocation explicitly selects a registration

- **GIVEN** multiple CDP-ready browsers are registered
- **AND** the invocation supplies one exact live registration ID
- **WHEN** a new agent-browser participant is allocated
- **THEN** Panerelay allocates it through that registration regardless of the saved default

#### Scenario: Invocation selects an unambiguous family

- **GIVEN** exactly one live CDP-ready registration has the explicitly selected browser family
- **WHEN** a new agent-browser participant is allocated
- **THEN** Panerelay allocates it through that registration

#### Scenario: Family selector is ambiguous

- **GIVEN** multiple live CDP-ready registrations have the explicitly selected browser family
- **WHEN** a new agent-browser participant is requested with that family selector
- **THEN** Panerelay rejects the request with the matching registration IDs
- **AND** it does not choose from focus, recency, or registration order

#### Scenario: Saved default is ready

- **GIVEN** no invocation selector is supplied
- **AND** the saved default identifies a live CDP-ready browser registration
- **WHEN** a new agent-browser participant is allocated
- **THEN** Panerelay allocates it through the saved registration

#### Scenario: Saved default is unavailable

- **GIVEN** no invocation selector is supplied
- **AND** the saved default is disconnected or lacks CDP relay capability
- **WHEN** another browser is ready
- **THEN** Panerelay rejects the request with guidance to reconnect or change the default
- **AND** it does not fall back to the other browser

#### Scenario: Only one browser is ready

- **GIVEN** no invocation selector or saved default exists
- **AND** exactly one live CDP-ready browser registration exists
- **WHEN** a new agent-browser participant is allocated
- **THEN** Panerelay automatically selects that registration

#### Scenario: Multiple browsers need an explicit choice

- **GIVEN** no invocation selector or saved default exists
- **AND** multiple live CDP-ready browser registrations exist
- **WHEN** a new agent-browser participant is requested
- **THEN** Panerelay rejects the request with actionable selection guidance and the available registration IDs

### Requirement: Participant lifetime is pinned to one browser

Panerelay SHALL bind each allocated agent-browser participant to exactly one browser registration until the participant reaches a terminal state. It SHALL perform release and cleanup through that same registration even if another browser becomes the saved default.

#### Scenario: Default changes during an active participant

- **GIVEN** an active participant is allocated through Chrome
- **WHEN** the user changes the saved default to Edge
- **THEN** the existing participant continues only through Chrome
- **AND** a later unscoped participant uses Edge

#### Scenario: Selected browser disconnects

- **GIVEN** an active participant is allocated through Chrome
- **WHEN** Chrome's registration disconnects while Edge remains ready
- **THEN** the participant fails without replaying or migrating commands to Edge
- **AND** Panerelay does not transfer its targets, authorization, or lease

#### Scenario: Provider releases a participant after selection changes

- **GIVEN** a participant was allocated through Chrome
- **AND** the saved default later changes to Edge
- **WHEN** the Provider closes the participant
- **THEN** Panerelay releases the Chrome participant through its original registration
- **AND** it does not send the release to Edge

### Requirement: Browser choice does not grant authority

Selecting or saving a browser SHALL NOT grant site access, authorize tabs, acquire a control lease, or copy permission state between browser registrations. Authorization and revocation SHALL remain browser-local and user-initiated.

#### Scenario: Selected browser lacks authorization

- **GIVEN** Edge is selected for a new participant
- **AND** Edge has not authorized the requested site or all-tabs operation
- **WHEN** the Agent requests that operation
- **THEN** Edge rejects it through the existing authorization flow
- **AND** Chrome's permission state is not consulted or copied

#### Scenario: User revokes one browser

- **GIVEN** Chrome and Edge each have active browser-local control state
- **WHEN** the user revokes Chrome authorization
- **THEN** Chrome terminates its affected participants and detaches its targets
- **AND** Edge's authorization and participants remain unchanged

### Requirement: Side-panel agents stay scoped to their browser

An Agent launched from a Panerelay Extension side panel SHALL explicitly select that Extension's current browser registration for its browser tools, independently of the saved default.

#### Scenario: Edge side panel runs while Chrome is the default

- **GIVEN** Chrome is the saved default
- **AND** the user starts an Agent from the Edge Extension side panel
- **WHEN** that Agent opens an agent-browser participant
- **THEN** the participant is allocated through the Edge registration
- **AND** Chrome remains the default for unrelated unscoped invocations

### Requirement: Users can inspect and manage the saved default

Panerelay SHALL provide an engine-neutral standalone CLI that lists live registrations, identifies the saved default, sets a default by exact registration ID or unambiguous browser family, and clears the default. These commands SHALL NOT alter browser permissions or active participants and SHALL be available through either the optional global `panerelay` executable or an explicit `npx` invocation of `@panerelay/cli`.

#### Scenario: User lists browsers

- **GIVEN** Chrome and Edge are registered
- **WHEN** the user lists Panerelay browsers
- **THEN** the CLI shows their browser families, opaque registration IDs, readiness, and which registration is the saved default

#### Scenario: User sets an unambiguous default

- **GIVEN** one live Edge registration exists
- **WHEN** the user selects Edge as the default
- **THEN** Panerelay saves that registration ID for future unscoped participants
- **AND** existing participants remain pinned to their original browsers

#### Scenario: User clears the default

- **GIVEN** a saved browser default exists
- **WHEN** the user clears it
- **THEN** future participants use the single-ready-browser rule or fail on ambiguity
- **AND** active participants and browser authorization remain unchanged

#### Scenario: User chooses an invocation mode

- **GIVEN** browser administration is independent of setup and automation engines
- **WHEN** the user invokes a browser command through a globally installed `panerelay` executable or `npx --yes @panerelay/cli`
- **THEN** both modes operate on the same protected browser registry and saved default
