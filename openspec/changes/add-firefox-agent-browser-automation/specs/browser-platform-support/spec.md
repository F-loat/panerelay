## MODIFIED Requirements

### Requirement: Browser registrations declare transport capabilities

Each Extension registration SHALL identify its browser family and SHALL explicitly declare its available automation transport as Chromium CDP, Firefox WebDriver, or unavailable. The Bridge SHALL treat absent capability data from a compatible older Chromium Extension as CDP-capable, SHALL treat every explicit unavailable value as authoritative, and SHALL allocate only the matching transport.

#### Scenario: Edge registers with CDP support

- **GIVEN** the Extension runs in Microsoft Edge with the debugger API available
- **WHEN** it registers with the Bridge
- **THEN** the registration identifies Edge and declares browser-level CDP relay support

#### Scenario: Firefox registers with WebDriver support

- **GIVEN** the Extension runs in Firefox and its managed automation handshake is ready
- **WHEN** it registers or refreshes capabilities with the Bridge
- **THEN** the registration identifies Firefox and declares WebDriver relay support without claiming CDP

#### Scenario: Firefox automation is not ready

- **GIVEN** Firefox was not started through the managed launcher or its driver is unavailable
- **WHEN** the Extension registers with the Bridge
- **THEN** the registration identifies Firefox and declares automation unavailable while keeping collaboration capabilities independent

### Requirement: Firefox provides its supported collaboration surface

The Firefox build SHALL provide a Firefox-native sidebar, Native Messaging, Agent conversations, project selection, supported page comments, localization, settings, and explicit WebDriver automation authorization. Collaboration features SHALL remain usable when the opt-in automation transport is unavailable.

#### Scenario: User opens Panerelay in Firefox

- **GIVEN** the Firefox build and matching Native Messaging manifest are installed
- **WHEN** the user opens the Panerelay sidebar
- **THEN** the side panel connects to the Bridge and exposes available Agent providers, page collaboration, and the current Firefox automation readiness

#### Scenario: Firefox page comments target an eligible page

- **GIVEN** Firefox grants the required site access for a normal web page
- **WHEN** the user starts page-comment selection
- **THEN** Panerelay uses the shared bounded page-comment workflow without granting an automation control lease

#### Scenario: User authorizes Firefox automation

- **GIVEN** the managed Firefox WebDriver transport is ready
- **WHEN** the user explicitly authorizes the current eligible tab or the supported all-tabs mode
- **THEN** Panerelay makes only that scope eligible for WebDriver rendezvous and keeps release controls visible

## ADDED Requirements

### Requirement: Browser artifacts contain only their platform adapters

The Chromium/Edge and Firefox Extension artifacts SHALL use separate background entry graphs. Each artifact SHALL include the browser-neutral collaboration code and only its own browser-specific automation, panel, indicator, and rendezvous adapters.

#### Scenario: Chromium artifact is inspected

- **GIVEN** a Chromium/Edge Extension archive was built
- **WHEN** release validation inspects its bundled module graph
- **THEN** the archive contains the Chromium debugger/CDP adapter
- **AND** it does not contain the Firefox WebDriver rendezvous adapter

#### Scenario: Firefox artifact is inspected

- **GIVEN** a Firefox Extension archive was built
- **WHEN** release validation inspects its bundled module graph
- **THEN** the archive contains the Firefox sidebar and WebDriver rendezvous adapters
- **AND** it does not contain the Chromium debugger/CDP, side-panel, badge, or controlled-favicon adapters

### Requirement: Unavailable browser automation fails closed

Panerelay SHALL NOT create an agent-browser transport session when the current browser explicitly reports automation unavailable or when the installed agent-browser cannot consume the selected transport. The failure SHALL identify the missing readiness step and SHALL NOT fall back to another browser.

#### Scenario: Firefox was not started for automation

- **GIVEN** Firefox collaboration is connected but automation is unavailable
- **WHEN** agent-browser requests a Panerelay browser session
- **THEN** the request fails before a participant, control lease, relay credential, or WebDriver session is allocated
- **AND** the error directs the user to the managed Firefox launcher

#### Scenario: Firefox transport loses readiness

- **GIVEN** Firefox previously declared WebDriver support
- **WHEN** its driver or managed automation handshake becomes unavailable
- **THEN** the Bridge revokes affected automation sessions and publishes the unavailable capability before accepting another session

## REMOVED Requirements

### Requirement: Unsupported Firefox automation fails closed

**Reason**: Firefox automation is now provided through an explicit WebDriver transport rather than the unavailable Chromium debugger API.

**Migration**: Treat Firefox registrations as WebDriver-capable only after their managed launcher and driver handshake is ready; otherwise apply the new general unavailable-automation requirement.
