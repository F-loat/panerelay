# guided-browser-readiness Specification

## Purpose

Define how Panerelay guides users from an unconfigured or unauthorized browser state to a ready integration without silently changing defaults, installing software, or granting Chromium browser permissions.

## Requirements

### Requirement: Installation does not silently change the user default

Panerelay SHALL omit automation integration installation and user-default options from the base setup path. It SHALL install each integration only when its explicit flag is supplied, require at least one selected integration when `--global-default` is requested, and leave existing defaults unchanged when no explicit default option is supplied.

#### Scenario: Reader follows the base installation path

- **GIVEN** the user needs the Native Host for the Extension and side panel
- **WHEN** they run `npx --yes @panerelay/setup`
- **THEN** Panerelay does not install or select an agent-browser Provider

#### Scenario: User explicitly selects a global default

- **GIVEN** the user invokes setup with `--agent-browser` and/or `--browser-use` plus `--global-default`
- **WHEN** setup completes
- **THEN** Panerelay sets the selected integrations as user-level defaults

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

### Requirement: Claude Code setup guidance is targeted

Setup, doctor, and the Extension SHALL identify Claude Code independently from Codex and Qoder and SHALL present the supported installation and login commands when it is unavailable.

#### Scenario: Claude Code is not discovered

- **GIVEN** setup cannot find a usable `claude` executable
- **WHEN** the user runs setup or doctor or selects the Claude provider
- **THEN** Panerelay reports Claude Code as optional, shows `npm install -g @anthropic-ai/claude-code`, and directs the user to run `claude` to authenticate

### Requirement: OpenCode setup guidance is targeted

Setup, doctor, and the Extension SHALL identify OpenCode independently from Codex, Claude Code, and Qoder and SHALL present the supported installation and authentication commands when it is unavailable. The guidance SHALL NOT install OpenCode, collect model credentials, grant browser authorization, or make the optional provider a Native Host prerequisite.

#### Scenario: OpenCode is not discovered

- **GIVEN** setup cannot find a usable `opencode` executable
- **WHEN** the user runs setup or doctor or selects the OpenCode provider
- **THEN** Panerelay reports OpenCode as optional, shows `npm install -g opencode-ai`, and directs the user to run `opencode auth login`

#### Scenario: OpenCode is discovered after setup

- **GIVEN** OpenCode was installed or moved after the Native Host registration was created
- **AND** the Side Panel still shows OpenCode as unavailable through its existing Native Host connection
- **WHEN** the user reruns setup and selects the Side Panel action to check providers again
- **THEN** Panerelay persists the newly resolved executable and reports its detected version
- **AND** the Side Panel refreshes provider descriptors without restarting the Native Host or changing the selected workspace, conversation, or browser authorization
- **AND** no Agent conversation or browser participant starts during discovery

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

### Requirement: Internal browser tool identifiers have concise presentation

The Extension SHALL present the internal MCP server identifier `panerelay_browser` as `panerelay` in user-visible activity titles while preserving the original identifier in Agent and MCP integration contracts.

#### Scenario: Panerelay browser activity is rendered

- **GIVEN** an Agent activity title starts with `panerelay_browser`
- **WHEN** the side panel renders that activity
- **THEN** the visible title starts with `panerelay`
- **AND** no protocol, MCP server, or tool identifier is rewritten

### Requirement: Authorization escalation remains user initiated

When a target operation requires broader Chromium browser authorization, Panerelay SHALL return an error that explicitly directs the user to the Panerelay Extension and SHALL surface a pending authorization action in the side panel. Browser permission acquisition SHALL occur only after the user activates that Extension action.

#### Scenario: Target creation lacks all-tabs authorization

- **GIVEN** an Agent requests `Target.createTarget` without all-tabs authorization
- **WHEN** Panerelay rejects the request
- **THEN** the Agent error states that the user must open the Panerelay Extension in Chrome or Edge and authorize all tabs, and the side panel shows an all-tabs authorization action

#### Scenario: User accepts the Extension authorization action

- **GIVEN** the side panel displays a pending all-tabs authorization request
- **WHEN** the user activates its authorize action
- **THEN** the Extension opens the current browser's native permission prompt and updates readiness only from that browser's result

#### Scenario: Agent attempts authorization without a user gesture

- **GIVEN** an Agent request triggered the authorization guidance
- **WHEN** no user activates the Extension action
- **THEN** Panerelay does not grant site access, authorize a tab, or acquire a control lease

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

### Requirement: Primary onboarding has two installation steps

Panerelay SHALL present the normal end-user onboarding path as installing the official Chrome Extension and installing the `panerelay-browser` Skill through `npx skills`. Manual `@panerelay/setup` commands, engine-specific connection details, compatibility boundaries, development installation, and troubleshooting SHALL remain available in an advanced section rather than the primary two-step path.

#### Scenario: New user follows the quickstart

- **GIVEN** a user opens either root README
- **WHEN** they follow the primary usage guide
- **THEN** step one links to the official Chrome Web Store Extension
- **AND** step two installs `panerelay-browser` using `npx skills add F-loat/panerelay --skill panerelay-browser`
- **AND** the guide states that the Agent will finish the selected local integration and pause for browser authorization

#### Scenario: User needs manual control

- **GIVEN** the user wants to run setup directly or inspect compatibility details
- **WHEN** they open the advanced guidance
- **THEN** they can find the explicit setup, doctor, connection, default-selection, development, and troubleshooting commands for all supported engines

### Requirement: Agent setup is delivered only through the installed Skill

Panerelay SHALL NOT publish or reference a standalone Agent setup document fetched with `curl` or another remote-document handoff. The website and repository documentation SHALL direct Agents and users to install `panerelay-browser` with `npx skills`; advanced human-readable references MAY describe the underlying commands without becoming a second Agent instruction source.

#### Scenario: User asks an Agent to configure Panerelay

- **GIVEN** the user reads the root README, website, or an automation package README
- **WHEN** they follow the Agent-directed setup path
- **THEN** the path installs `panerelay-browser` through `npx skills`
- **AND** it does not ask the Agent to fetch `agent-setup.md` with `curl`

#### Scenario: Website is built

- **GIVEN** the website source and build configuration are inspected
- **WHEN** the production bundle is created
- **THEN** it does not copy or serve a standalone `agent-setup.md`
- **AND** no site prompt or test depends on that URL
