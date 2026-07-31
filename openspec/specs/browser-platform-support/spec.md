# browser-platform-support Specification

## Purpose

Define observable browser-family behavior so Edge receives Chromium automation parity while Firefox provides its supported collaboration surface without false CDP capability claims.

## Requirements

### Requirement: Browser registrations declare transport capabilities

Each Extension registration SHALL identify its browser family and SHALL explicitly declare whether it can provide the CDP relay required by agent-browser. The Bridge SHALL treat absent capability data from a compatible older Chromium Extension as CDP-capable and SHALL treat an explicit unsupported value as authoritative.

#### Scenario: Edge registers with CDP support

- **GIVEN** the Extension runs in Microsoft Edge with the debugger API available
- **WHEN** it registers with the Bridge
- **THEN** the registration identifies Edge and declares browser-level CDP relay support

#### Scenario: Firefox registers without CDP support

- **GIVEN** the Extension runs in Firefox without the WebExtension debugger API
- **WHEN** it registers with the Bridge
- **THEN** the registration identifies Firefox and declares CDP relay unavailable

### Requirement: Edge supports the Chromium workflow

The Edge build SHALL provide the side panel, Native Messaging, explicit site authorization, target lifecycle, browser-level CDP relay, controlled-tab visibility, revocation, page comments, and Agent conversations through the same security invariants as the Chrome build.

#### Scenario: Agent controls an authorized Edge tab

- **GIVEN** Edge is connected and the user has explicitly authorized an eligible tab
- **WHEN** agent-browser 0.33.0 creates a Panerelay relay session and operates that tab
- **THEN** target and CDP behavior is forwarded under the existing compatibility classifications and control lease

#### Scenario: Edge authorization is revoked

- **GIVEN** an Edge tab is controlled
- **WHEN** the user releases authorization or Edge removes the site permission
- **THEN** Panerelay detaches the debugger, revokes control, updates visible state, and rejects subsequent mutations

### Requirement: Firefox provides its supported collaboration surface

The Firefox build SHALL provide a Firefox-native sidebar, Native Messaging, Agent conversations, project selection, supported page comments, localization, and settings that do not depend on the WebExtension debugger API.

#### Scenario: User opens Panerelay in Firefox

- **GIVEN** the Firefox build and matching Native Messaging manifest are installed
- **WHEN** the user opens the Panerelay sidebar
- **THEN** the side panel connects to the Bridge and exposes available Agent providers and non-CDP page collaboration features

#### Scenario: Firefox page comments target an eligible page

- **GIVEN** Firefox grants the required site access for a normal web page
- **WHEN** the user starts page-comment selection
- **THEN** Panerelay uses the shared bounded page-comment workflow without granting an automation control lease

### Requirement: Unsupported Firefox automation fails closed

Panerelay SHALL NOT offer browser authorization or create an agent-browser relay session for a registration that explicitly lacks CDP relay support. The failure SHALL identify the connected browser limitation and SHALL NOT fall back to another browser or report ignored commands as successful.

#### Scenario: agent-browser is invoked while Firefox is connected

- **GIVEN** the current Bridge registration identifies Firefox with CDP relay unavailable
- **WHEN** agent-browser requests a Panerelay browser session
- **THEN** the request fails before a control lease or CDP WebSocket is created with a Firefox-specific unsupported message

#### Scenario: Firefox side panel shows browser settings

- **GIVEN** Firefox lacks CDP relay support
- **WHEN** the user opens Panerelay browser settings
- **THEN** automation authorization controls are disabled or omitted and the limitation is explained
- **AND** Agent conversation and page-comment controls remain available
