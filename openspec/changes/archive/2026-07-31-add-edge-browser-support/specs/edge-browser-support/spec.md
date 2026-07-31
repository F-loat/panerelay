## Purpose

Define observable Microsoft Edge integration behavior while preserving Panerelay's existing Chromium authorization, CDP relay, control, and revocation boundaries.

## ADDED Requirements

### Requirement: Browser registrations declare Edge CDP support

The Extension SHALL identify Microsoft Edge registrations and SHALL explicitly declare whether the connected runtime can provide the browser-level CDP relay required by agent-browser. The Bridge SHALL treat absent capability data from a compatible older Chromium Extension as CDP-capable and SHALL treat an explicit unsupported value as authoritative.

#### Scenario: Edge registers with CDP support

- **GIVEN** the Extension runs in Microsoft Edge with the debugger API available
- **WHEN** it registers with the Bridge
- **THEN** the registration identifies Edge and declares browser-level CDP relay support

#### Scenario: Older Chrome registration omits capability data

- **GIVEN** a compatible older Chrome Extension registers without browser capability fields
- **WHEN** agent-browser requests a Panerelay relay session
- **THEN** the Bridge preserves the existing Chromium CDP behavior

#### Scenario: A browser explicitly lacks CDP support

- **GIVEN** the current registration explicitly declares CDP relay unavailable
- **WHEN** agent-browser requests a Panerelay relay session
- **THEN** the request fails before a participant, control lease, CDP WebSocket, or debugger attachment is created

### Requirement: Edge supports the Chromium workflow

The Edge runtime SHALL provide the side panel, Native Messaging, explicit site authorization, target lifecycle, browser-level CDP relay, controlled-tab visibility, revocation, page comments, and Agent conversations through the same security invariants as Chrome.

#### Scenario: Agent controls an authorized Edge tab

- **GIVEN** Edge is connected and the user has explicitly authorized an eligible tab
- **WHEN** agent-browser 0.33.0 creates a Panerelay relay session and operates that tab
- **THEN** target and CDP behavior is forwarded under the existing compatibility classifications and control lease

#### Scenario: Edge authorization is revoked

- **GIVEN** an Edge tab is controlled
- **WHEN** the user releases authorization or Edge removes the site permission
- **THEN** Panerelay detaches the debugger, revokes control, updates visible state, and rejects subsequent mutations

#### Scenario: Edge target lifecycle changes

- **GIVEN** an authorized Edge relay session is active
- **WHEN** an eligible target is created, updated, selected, or closed
- **THEN** the existing opaque target lifecycle and participant-local session behavior applies without exposing raw Edge tab identifiers

### Requirement: Edge Native Messaging is installed per user

Panerelay setup SHALL install the same identity-scoped Chromium Native Messaging manifest in documented per-user Microsoft Edge locations on macOS and Linux, and update and uninstall SHALL remain idempotent without removing unrelated hosts.

#### Scenario: Edge discovers the Native Host on macOS or Linux

- **GIVEN** a user runs setup on a supported macOS or Linux system
- **WHEN** Edge searches its per-user Native Messaging location
- **THEN** it finds a Panerelay manifest containing only the configured `chrome-extension://` origin

#### Scenario: Setup is rerun or removed

- **GIVEN** Edge Native Messaging files already exist or are partially absent
- **WHEN** the user runs update or uninstall
- **THEN** Panerelay replaces or removes only its managed files and leaves unrelated Native Messaging hosts untouched

### Requirement: Edge compatibility claims remain evidence based

Panerelay SHALL classify Edge capability groups as `Forwarded` until representative real-Edge evidence is recorded, and SHALL keep browser-process ownership limitations `Unsupported` when they cannot be provided by the Extension-backed architecture.

#### Scenario: Automated Edge-compatible tests pass without a real Edge run

- **GIVEN** protocol, Bridge, Extension, setup, and package tests pass against the shared Chromium implementation
- **WHEN** compatibility documentation is updated
- **THEN** Edge is not described as `Verified`

#### Scenario: A command requires Edge process ownership

- **GIVEN** an agent-browser command requires isolated contexts, process flags, browser-wide close, or top-level request containment
- **WHEN** it is requested through Panerelay in Edge
- **THEN** the command fails closed under the same `Unsupported` classification as Chrome
