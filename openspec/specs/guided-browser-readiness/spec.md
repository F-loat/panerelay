# guided-browser-readiness Specification

## Purpose

Define how Panerelay guides users from an unconfigured or unauthorized browser state to a ready integration without silently changing defaults, installing software, or granting Chrome permissions.

## Requirements

### Requirement: Installation does not silently change the default Provider

Panerelay SHALL keep all existing setup CLI options for project-level and user-level default Provider configuration, SHALL omit those options from the default README installation command, and SHALL leave existing default Provider values unchanged when setup is run without an explicit default option.

#### Scenario: Reader follows the default installation path

- **GIVEN** the user has an existing agent-browser configuration
- **WHEN** they run the README installation command without a default Provider option
- **THEN** Panerelay registers its integration without changing the project-level or user-level default Provider

#### Scenario: User explicitly selects a setup scope

- **GIVEN** the user invokes setup with `--project-provider` or `--global-provider`
- **WHEN** setup completes
- **THEN** Panerelay preserves the existing scoped default-Provider behavior

### Requirement: Extension settings manage the user-level default

When the Native Host is connected, the Extension SHALL identify this setting as the user-level default Provider and let the user set or clear that value without uninstalling any Panerelay integration. The settings row SHALL match the single-line presentation of theme and language: `Default Provider` on the left, an `agent-browser` toggle on the right, and no secondary status description. Clearing SHALL remove only a current Panerelay default and SHALL leave another Provider's value unchanged.

#### Scenario: User sets Panerelay as the user-level default

- **GIVEN** the Native Host is connected and the current user-level default is not Panerelay
- **WHEN** the user selects the Extension's set-default action
- **THEN** the managed user-level configuration selects Panerelay and the settings state refreshes

#### Scenario: User views the default-Provider setting

- **GIVEN** the Extension settings are open
- **WHEN** the default-Provider row is rendered
- **THEN** it uses the same left-label alignment and height as theme and language
- **AND** the right-side `agent-browser` toggle indicates whether Panerelay is its default Provider
- **AND** no Native Host or current-value description is shown below the label

#### Scenario: User cancels the Panerelay user-level default

- **GIVEN** the current user-level default is Panerelay
- **WHEN** the user selects the Extension's cancel-default action
- **THEN** Panerelay removes only that default selection while keeping its Provider registration, Native Host, and Agent Skill installed

#### Scenario: Another Provider is the user-level default

- **GIVEN** the user-level default names another Provider
- **WHEN** the Extension reads or refreshes settings
- **THEN** it does not overwrite or offer to clear the other Provider as though Panerelay owned it

### Requirement: Missing Native Host guidance is actionable

The Extension SHALL distinguish a recognized missing Native Messaging Host from a transient disconnected state in Chrome, Edge, and Firefox and SHALL show a compact localized setup guide with the supported setup command and a retry action. Guidance SHALL name the current browser family when the remedy or capability differs.

#### Scenario: A supported browser cannot find the Native Host

- **GIVEN** the Extension receives the current browser's recognized Native Messaging host-not-found failure
- **WHEN** the side panel renders its readiness state
- **THEN** it explains that the Panerelay local integration is not installed, shows `npx --yes @panerelay/setup`, and provides a retry action

#### Scenario: Connection is transiently unavailable

- **GIVEN** the Native Host was installed but the connection closed or is reconnecting
- **WHEN** the side panel renders its readiness state
- **THEN** it presents a connection recovery state without claiming that installation is definitely missing

#### Scenario: Firefox lacks browser automation

- **GIVEN** Firefox is connected to a valid Native Host and reports no CDP relay capability
- **WHEN** the side panel renders readiness
- **THEN** Agent conversations remain ready while browser automation is identified as unsupported rather than missing or disconnected

### Requirement: Known Provider setup failures produce targeted guidance

Panerelay SHALL recognize bounded error signatures that indicate the Panerelay agent-browser Provider is missing or not ready and SHALL present installation or repair guidance while preserving the original diagnostic detail. Unrecognized failures SHALL remain ordinary errors.

#### Scenario: Panerelay plugin is missing

- **GIVEN** an Agent tool result reports a recognized missing Panerelay Provider or plugin signature
- **WHEN** the side panel renders the failed tool activity
- **THEN** it presents the Panerelay setup command and retry guidance instead of leaving only a generic `success=false` message

#### Scenario: Generic plugin failure

- **GIVEN** a plugin failure does not match a recognized Panerelay setup signature
- **WHEN** the side panel renders the failure
- **THEN** it preserves the normal failure presentation and does not claim the local integration is uninstalled

### Requirement: Internal browser tool identifiers have concise presentation

The Extension SHALL present the internal MCP server identifier `panerelay_browser` as `panerelay` in user-visible activity titles while preserving the original identifier in Agent and MCP integration contracts.

#### Scenario: Panerelay browser activity is rendered

- **GIVEN** an Agent activity title starts with `panerelay_browser`
- **WHEN** the side panel renders that activity
- **THEN** the visible title starts with `panerelay`
- **AND** no protocol, MCP server, or tool identifier is rewritten

### Requirement: Authorization escalation remains user initiated

When a target operation requires broader Chrome authorization, Panerelay SHALL return an error that explicitly directs the user to the Panerelay Extension and SHALL surface a pending authorization action in the side panel. Chrome permission acquisition SHALL occur only after the user activates that Extension action.

#### Scenario: Target creation lacks all-tabs authorization

- **GIVEN** an Agent requests `Target.createTarget` without all-tabs authorization
- **WHEN** Panerelay rejects the request
- **THEN** the Agent error states that the user must open the Panerelay Extension and authorize all tabs, and the side panel shows an all-tabs authorization action

#### Scenario: User accepts the Extension authorization action

- **GIVEN** the side panel displays a pending all-tabs authorization request
- **WHEN** the user activates its authorize action
- **THEN** the Extension opens Chrome's native permission prompt and updates readiness only from Chrome's result

#### Scenario: Agent attempts authorization without a user gesture

- **GIVEN** an Agent request triggered the authorization guidance
- **WHEN** no user activates the Extension action
- **THEN** Panerelay does not grant site access, authorize a tab, or acquire a control lease
