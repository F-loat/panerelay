## MODIFIED Requirements

### Requirement: Installation does not silently change the default Provider

Panerelay SHALL omit agent-browser Provider installation and default-Provider options from the base setup path. It SHALL install the Provider only with `--agent-browser`, require that flag when a project-level or user-level default scope is requested, and leave existing default Provider values unchanged when no explicit agent-browser default option is supplied.

#### Scenario: Reader follows the base installation path

- **GIVEN** the user needs the Native Host for the Extension and side panel
- **WHEN** they run `npx --yes @panerelay/setup`
- **THEN** Panerelay does not install or select an agent-browser Provider

#### Scenario: User explicitly selects a setup scope

- **GIVEN** the user invokes setup with `--agent-browser` and `--project-provider` or `--global-provider`
- **WHEN** setup completes
- **THEN** Panerelay preserves the existing scoped default-Provider behavior

### Requirement: Missing Native Host guidance is actionable

When the browser reports that the Native Host is missing, the Extension SHALL explain Panerelay's local browser-relay function and SHALL show the base `npx --yes @panerelay/setup` command. Its title and primary description SHALL use the connected welcome state's heading placement below the welcome icon and remain outside the card stack. It SHALL present supporting benefits, setup action, and optional automation tools in that order as separate sibling cards without one enclosing card, using the same content width, lightweight surface hierarchy, and readable title/body scale as the connected welcome state rather than timeline microcopy sizing. The setup-action card SHALL use a localized action-oriented installation title with the same title treatment as the optional-tools card instead of presenting a missing-Host diagnostic sentence. It SHALL render the visible command on the theme's conventional muted-gray code surface. It SHALL present `agent-browser` and `browser-use` as independent optional selections with neither selected by default. Those selections SHALL be compact text-only toggles using the same ordinary and selected treatments as the settings controls, without secondary descriptions, checkbox glyphs, or status indicators. The visible command SHALL append the selected fixed flags in deterministic order, SHALL support selecting both integrations in one invocation, and SHALL provide an accessible compact icon-only copy action with localized copied confirmation. Retrying the Native Host connection or temporarily hiding and restoring the missing-Host view SHALL preserve the current optional selections and generated command. The guide SHALL state that the optional selections connect already-installed automation tools rather than install those upstream tools.

#### Scenario: User copies the base setup command

- **GIVEN** the Native Host is missing and neither optional integration is selected
- **WHEN** the user activates the copy action
- **THEN** the Extension copies `npx --yes @panerelay/setup`
- **AND** it announces a localized copied confirmation

#### Scenario: User views the missing-Host guide

- **GIVEN** the connected welcome state establishes the side panel's standard card width and surface treatment
- **WHEN** the missing-Host guide renders
- **THEN** the title and primary description appear outside the card stack using the connected welcome heading pattern
- **AND** supporting benefits, setup action, and tool selection appear in that order as three separate cards at that standard width
- **AND** no outer border or background encloses all three cards

#### Scenario: User selects both supported integrations

- **GIVEN** the Native Host is missing
- **WHEN** the user selects both `agent-browser` and `browser-use`
- **THEN** the visible and copied command is `npx --yes @panerelay/setup --agent-browser --browser-use`
- **AND** both selections remain independently removable
- **AND** no browser authorization, Native Host request, or upstream engine installation occurs before the user runs that command

#### Scenario: Connection retry preserves the chosen integrations

- **GIVEN** the Native Host is missing and the user selected one or both optional integrations
- **WHEN** the user retries the connection and the missing-Host view remains visible or later returns
- **THEN** every chosen integration remains selected
- **AND** the visible setup command retains the corresponding fixed flags

### Requirement: Extension settings manage the user-level default

When the Native Host is connected, the Extension SHALL present one compact `Set as default` / `设为默认` settings row for user-level automation defaults. The row SHALL contain independent `agent-browser` and `browser-use` buttons, SHALL use selected button styling to communicate enabled state, and SHALL NOT render trailing circular indicators. An installed integration SHALL set or conditionally clear only its own user-level default. An uninstalled integration SHALL remain clickable, SHALL use ordinary pointer behavior, SHALL replace its label with localized click-to-install copy on hover, and SHALL run only its matching setup-backed installation before selecting it as the default. Hover SHALL NOT change a button's background, border, or text color; the missing-integration label replacement is the only hover feedback. Neither action SHALL change the other engine's default, grant browser authorization, or accept arbitrary installation commands.

#### Scenario: User sets agent-browser to use Panerelay by default

- **GIVEN** the Native Host is connected, the setup-managed agent-browser Provider is registered, and the current user-level default is not Panerelay
- **WHEN** the user selects the `agent-browser` action
- **THEN** the managed user-level agent-browser configuration selects Panerelay
- **AND** the `agent-browser` button renders selected without a trailing circular indicator
- **AND** Browser Use's connection preference remains unchanged

#### Scenario: User sets browser-use to use Panerelay by default

- **GIVEN** the Native Host is connected and the setup-managed browser-use adapter is registered
- **AND** Browser Use currently defaults to Direct
- **WHEN** the user selects the `browser-use` action
- **THEN** the saved Browser Use connection preference becomes Panerelay Extension
- **AND** the `browser-use` button renders selected without a trailing circular indicator
- **AND** agent-browser's Provider default remains unchanged

#### Scenario: User views the default settings row

- **GIVEN** the Extension settings are open
- **WHEN** the automation-default row is rendered
- **THEN** its left label is `Set as default` in English or `设为默认` in Chinese
- **AND** compact `agent-browser` and `browser-use` buttons appear on the right
- **AND** neither button contains a trailing status dot or secondary description

#### Scenario: User hovers an installed unselected integration

- **GIVEN** an integration is installed but is not the current Panerelay default
- **WHEN** the user hovers its settings button
- **THEN** the button's background, border, and text color remain unchanged
- **AND** its engine label remains visible

#### Scenario: User clears a Panerelay automation default

- **GIVEN** agent-browser or Browser Use currently selects Panerelay by default
- **WHEN** the user activates that selected engine button
- **THEN** Panerelay clears only the selected engine's Panerelay default
- **AND** agent-browser retains its Provider registration while Browser Use retains its adapter registration and one-run override behavior
- **AND** the other engine's default remains unchanged

#### Scenario: agent-browser integration is unavailable

- **GIVEN** the Panerelay agent-browser Provider is not registered in setup-managed configuration
- **WHEN** Extension settings render and the Native Host is connected
- **THEN** the agent-browser button remains clickable with an ordinary pointer
- **AND** hovering replaces its label with `Click to install` in English or `点击安装` in Chinese
- **WHEN** the user clicks it
- **THEN** the Native Host runs only the lockstep setup operation for `--agent-browser`
- **AND** a successful installation selects Panerelay as the agent-browser user-level default and refreshes the button state
- **AND** it does not install agent-browser itself, create a participant, or grant browser authorization

#### Scenario: browser-use integration is unavailable

- **GIVEN** the browser-use adapter is not registered in protected Panerelay configuration
- **WHEN** Extension settings render and the Native Host is connected
- **THEN** the browser-use button remains clickable with an ordinary pointer
- **AND** hovering replaces its label with `Click to install` in English or `点击安装` in Chinese
- **WHEN** the user clicks it
- **THEN** the Native Host runs only the lockstep setup operation for `--browser-use`
- **AND** a successful installation selects Panerelay Extension as the browser-use default and refreshes the button state
- **AND** it does not install Browser Use itself, create a participant, or grant browser authorization

#### Scenario: Integration installation is pending or fails

- **GIVEN** the user clicked an uninstalled integration
- **WHEN** the bounded Native Host operation is running
- **THEN** only that button shows localized installing copy and rejects duplicate activation
- **WHEN** setup cannot complete, times out, or the package runner is unavailable
- **THEN** the selected and available states remain derived from protected setup-managed configuration
- **AND** the Extension shows concise localized guidance containing the exact manual setup command
- **AND** no raw command output, browser authorization, control state, or arbitrary executable input crosses the integration boundary

#### Scenario: Another agent-browser Provider is the user-level default

- **GIVEN** the user-level agent-browser default names another Provider
- **WHEN** the Extension reads or refreshes settings
- **THEN** it does not present that value as a Panerelay-owned selection
- **AND** it does not offer to clear the other Provider as though Panerelay owned it

### Requirement: Known Provider setup failures produce targeted guidance

Panerelay SHALL recognize bounded error signatures that indicate the Panerelay agent-browser Provider is missing or not ready and SHALL present the explicit agent-browser integration installation or repair command while preserving the original diagnostic detail. Unrecognized failures SHALL remain ordinary errors.

#### Scenario: Panerelay plugin is missing

- **GIVEN** an Agent tool result reports a recognized missing Panerelay Provider or plugin signature
- **WHEN** the side panel renders the failed tool activity
- **THEN** it presents `npx --yes @panerelay/setup --agent-browser` and retry guidance instead of leaving only a generic `success=false` message

#### Scenario: Generic plugin failure

- **GIVEN** a plugin failure does not match a recognized Panerelay setup signature
- **WHEN** the side panel renders the failure
- **THEN** it preserves the normal failure presentation and does not claim the local integration is uninstalled
