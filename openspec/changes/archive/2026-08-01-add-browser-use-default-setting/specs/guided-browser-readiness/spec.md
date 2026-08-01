## MODIFIED Requirements

### Requirement: Extension settings manage the user-level default

When the Native Host is connected, the Extension SHALL present one compact `Set as default` / `设为默认` settings row for user-level automation defaults. The row SHALL contain independent `agent-browser` and `Browser Use` toggle buttons, SHALL use selected button styling to communicate enabled state, and SHALL NOT render trailing circular indicators. The agent-browser action SHALL set or conditionally clear Panerelay as its user-level Provider. The Browser Use action SHALL be available only when its setup-managed adapter is registered and SHALL select Panerelay Extension or Direct as its saved connection mode. Neither action SHALL install an integration, change the other engine's default, or grant browser authorization.

#### Scenario: User sets agent-browser to use Panerelay by default

- **GIVEN** the Native Host is connected and the current user-level agent-browser default is not Panerelay
- **WHEN** the user selects the `agent-browser` action
- **THEN** the managed user-level agent-browser configuration selects Panerelay
- **AND** the `agent-browser` button renders selected without a trailing circular indicator
- **AND** Browser Use's connection preference remains unchanged

#### Scenario: User sets Browser Use to use Panerelay by default

- **GIVEN** the Native Host is connected and the setup-managed Browser Use adapter is registered
- **AND** Browser Use currently defaults to Direct
- **WHEN** the user selects the `Browser Use` action
- **THEN** the saved Browser Use connection preference becomes Panerelay Extension
- **AND** the `Browser Use` button renders selected without a trailing circular indicator
- **AND** agent-browser's Provider default remains unchanged

#### Scenario: User views the default settings row

- **GIVEN** the Extension settings are open
- **WHEN** the automation-default row is rendered
- **THEN** its left label is `Set as default` in English or `设为默认` in Chinese
- **AND** compact `agent-browser` and `Browser Use` buttons appear on the right
- **AND** neither button contains a trailing status dot or secondary description

#### Scenario: User clears a Panerelay automation default

- **GIVEN** agent-browser or Browser Use currently selects Panerelay by default
- **WHEN** the user activates that selected engine button
- **THEN** Panerelay clears only the selected engine's Panerelay default
- **AND** agent-browser retains its Provider registration while Browser Use retains its adapter registration and one-run override behavior
- **AND** the other engine's default remains unchanged

#### Scenario: Browser Use integration is unavailable

- **GIVEN** the Browser Use adapter is not registered in protected Panerelay configuration
- **WHEN** Extension settings render or receive a Browser Use default mutation
- **THEN** the Browser Use button is visible but unavailable
- **AND** the mutation fails explicitly without installing Browser Use, creating a participant, or changing any preference

#### Scenario: Another agent-browser Provider is the user-level default

- **GIVEN** the user-level agent-browser default names another Provider
- **WHEN** the Extension reads or refreshes settings
- **THEN** it does not present that value as a Panerelay-owned selection
- **AND** it does not offer to clear the other Provider as though Panerelay owned it

### Requirement: Main-panel browser authorization remains available independently of Agent installation

When the Native Host and Bridge are connected, the Extension SHALL keep the compact main-panel browser-authorization card visible whether the selected Agent is ready or unavailable. Agent installation state SHALL continue to gate conversation suggestions, history, composition, and other Agent operations, but SHALL NOT hide browser authorization or change its current scope. Selecting an Agent SHALL NOT itself grant, revoke, or otherwise mutate browser authorization.

#### Scenario: User selects an unavailable Agent

- **GIVEN** the Native Host and Bridge are connected
- **AND** a supported Agent is visible but not installed
- **WHEN** the user selects that Agent in the side panel
- **THEN** the main panel shows its targeted setup guidance and the compact browser-authorization card
- **AND** Agent suggestions and conversation actions remain unavailable
- **AND** the authorization card reflects the existing browser scope and lets the user explicitly change it

#### Scenario: User switches between ready and unavailable Agents

- **GIVEN** the user has explicitly selected a browser authorization scope
- **WHEN** the user switches between a ready Agent and an unavailable Agent
- **THEN** the compact browser-authorization card remains visible
- **AND** the selected authorization scope is unchanged

### Requirement: Extension shows the default-control setting only for meaningful browser choice

The Extension SHALL label the current-browser routing preference `Control by default` in English or `默认受控` in Chinese. It SHALL render that setting only when more than one live Panerelay browser connection exists. A standard switch SHALL communicate whether the current browser is the saved routing default. The row SHALL NOT display the current browser name or a separate decorative status indicator. Browser-count visibility and default selection SHALL remain routing preferences only and SHALL NOT grant authorization or control.

#### Scenario: Multiple browsers are connected

- **GIVEN** more than one live browser registration exists
- **WHEN** the Extension opens or refreshes settings
- **THEN** the `Control by default` / `默认受控` setting is visible
- **AND** its switch reflects whether the current browser is the saved routing default
- **AND** the row does not display a browser-family name or separate status indicator

#### Scenario: Only one browser is connected

- **GIVEN** only the current browser has a live registration
- **WHEN** the Extension opens or refreshes settings
- **THEN** the default-control setting is not rendered
- **AND** the existing saved browser default is neither changed nor cleared

#### Scenario: Another browser disconnects

- **GIVEN** the default-control setting was visible for multiple live browsers
- **WHEN** another browser disconnects and the Extension next refreshes browser-default state
- **THEN** the Bridge reports that multiple browser choice is no longer present
- **AND** the Extension hides the setting without changing browser selection, authorization, participants, or leases
