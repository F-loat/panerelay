## Purpose

Define how Panerelay gives agent-browser controlled access to explicitly authorized Firefox tabs through a user-enabled Firefox automation session without weakening browser ownership or revocation boundaries.

## ADDED Requirements

### Requirement: Firefox automation startup is explicit

Panerelay SHALL provide an opt-in Firefox launcher that enables the supported automation transport and SHALL NOT close, restart, replace, or reconfigure an already-running Firefox process without an explicit user action.

#### Scenario: Firefox was started normally

- **GIVEN** the Panerelay Firefox Extension is connected from a process that was not started with the required automation transport
- **WHEN** the user or agent-browser requests browser automation
- **THEN** Panerelay reports that Firefox must be closed and started through the Panerelay launcher
- **AND** it creates no automation participant, credential, or control lease

#### Scenario: User starts Firefox through Panerelay

- **GIVEN** setup installed a matching Firefox launcher and automation dependencies
- **WHEN** the user closes Firefox and explicitly starts that launcher
- **THEN** Firefox starts with the user's selected profile and the minimum browser-supported remote-control capability
- **AND** the Extension reports automation readiness only after the local relay completes its authenticated handshake

### Requirement: Firefox uses the agent-browser WebDriver backend

The Panerelay agent-browser Provider SHALL select agent-browser's WebDriver backend for Firefox and SHALL provide only a participant-scoped Panerelay relay endpoint and virtual session identity. It SHALL NOT expose the raw Firefox or driver endpoint and SHALL NOT describe Firefox as CDP-capable.

#### Scenario: Compatible agent-browser connects

- **GIVEN** Firefox automation is ready and agent-browser supports WebDriver browser providers
- **WHEN** agent-browser creates a Panerelay Provider session
- **THEN** the Provider selects the WebDriver backend using a scoped relay endpoint and session identity
- **AND** agent-browser retains ownership of snapshot, locator, wait, input, and command semantics

#### Scenario: Installed agent-browser is CDP-only

- **GIVEN** Firefox automation is requested through an agent-browser version whose Provider contract accepts only CDP
- **WHEN** Panerelay checks compatibility
- **THEN** setup, doctor, and the Provider return targeted upgrade guidance
- **AND** Panerelay does not translate WebDriver into fake CDP

### Requirement: Only authorized Firefox tabs map to WebDriver windows

Panerelay SHALL map a Firefox WebDriver window to an opaque Extension target only after a one-time challenge sent to that window is returned by the Panerelay content script with a current browser-attested tab identity. The Bridge SHALL accept the mapping only when that tab has current site permission and explicit automation authorization.

#### Scenario: Authorized tab completes rendezvous

- **GIVEN** the user explicitly authorized an eligible Firefox tab and its current origin
- **WHEN** the Bridge sends a fresh challenge through the corresponding WebDriver window
- **THEN** the Extension returns the challenge with the sender tab's browser-attested identity
- **AND** the Bridge creates a participant-local mapping without exposing the raw Extension tab ID

#### Scenario: Mapping is not uniquely trustworthy

- **GIVEN** a challenge is missing, stale, duplicated, returned from an unauthorized tab, or inconsistent with the current document
- **WHEN** the Bridge attempts to map the WebDriver window
- **THEN** it rejects the mapping without forwarding an automation command or expanding authorization

### Requirement: Firefox target lifecycle preserves user ownership

Panerelay SHALL expose only authorized Firefox windows to a participant, SHALL keep Agent-created windows within the current authorization mode, and SHALL preserve the user's visible active tab and browser process whenever the underlying WebDriver operation permits it.

#### Scenario: Participant lists existing tabs

- **GIVEN** Firefox contains authorized and unauthorized tabs
- **WHEN** agent-browser lists tabs through Panerelay
- **THEN** the result contains only participant-scoped opaque targets mapped from authorized tabs

#### Scenario: Agent requests a new tab without broad authorization

- **GIVEN** the user authorized only one Firefox tab
- **WHEN** agent-browser requests creation of another tab
- **THEN** Panerelay fails with a user-facing all-tabs authorization action
- **AND** it does not create or expose the requested tab before the user grants that authorization

#### Scenario: Agent creates a tab with broad authorization

- **GIVEN** the user granted the supported all-tabs authorization mode
- **WHEN** agent-browser creates a Firefox tab
- **THEN** the new tab is mapped into the participant inventory and remains in the background when Firefox supports that behavior

### Requirement: Firefox commands report honest compatibility

Panerelay SHALL forward supported WebDriver operations without implementing their automation semantics and SHALL reject commands that require unavailable CDP-only, browser-process, system-access, or containment capabilities.

#### Scenario: Supported page interaction runs

- **GIVEN** an authorized Firefox target and a live control lease
- **WHEN** agent-browser performs a command supported by its WebDriver backend
- **THEN** Panerelay forwards the bounded WebDriver operation and returns its real success or failure

#### Scenario: CDP-only operation is requested

- **GIVEN** the selected command requires tracing, profiling, Chromium request interception, browser contexts, or another unavailable capability
- **WHEN** agent-browser evaluates the command for its WebDriver backend
- **THEN** it rejects the operation as unsupported without sending a substitute command or reporting false success

### Requirement: Firefox revocation is immediate and complete

Firefox site-permission removal, tab-authorization release, Extension disconnect, document change, driver exit, launcher exit, participant close, or Bridge shutdown SHALL invalidate affected window mappings, pending challenges, participant credentials, and control visibility before later mutations are accepted.

#### Scenario: User revokes Firefox authorization

- **GIVEN** an Agent controls an authorized Firefox tab
- **WHEN** the user releases that tab or removes its site permission
- **THEN** Panerelay invalidates its WebDriver mapping and fails pending or later commands for that target
- **AND** unrelated authorized targets remain usable only when their mappings and lease are still valid

#### Scenario: Firefox automation process disconnects

- **GIVEN** one or more Firefox participants are connected
- **WHEN** the driver, Firefox automation endpoint, Extension, or Bridge disconnects
- **THEN** Panerelay closes every affected virtual session and clears visible controlled state
- **AND** it does not close the user's Firefox process unless the user explicitly requested browser shutdown

### Requirement: Firefox automation data remains bounded

Panerelay SHALL keep raw WebDriver commands and results inside the local relay, SHALL use opaque protocol identifiers outside browser-specific adapters, and SHALL not log page content, input values, cookies, screenshots, request bodies, challenges, or driver payloads by default.

#### Scenario: Activity is shown to the user

- **GIVEN** agent-browser performs a Firefox operation
- **WHEN** the Extension renders control activity
- **THEN** it receives the existing bounded provider-neutral activity category and lifecycle
- **AND** no raw WebDriver route, payload, result, or browser tab identity is included
