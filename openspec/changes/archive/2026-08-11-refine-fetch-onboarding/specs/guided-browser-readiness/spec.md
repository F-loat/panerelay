## MODIFIED Requirements

### Requirement: Main-panel browser authorization remains available independently of Agent installation

When the Native Host and Bridge are connected, the Extension SHALL keep two independent compact main-panel authorization cards visible whether the selected Agent is ready or unavailable. The `Automation authorization` / `自动化授权` card SHALL provide current-tab and all-supported-tabs choices, and the `Fetch authorization` / `Fetch 授权` card SHALL provide current-domain and all-domain choices. Each card SHALL present its own icon, label, current status, and selector. Each compact selector SHALL contain only its two named scopes and SHALL NOT include a separate release or clear option. Selecting an inactive scope SHALL enable it, while selecting the active scope again SHALL disable that scope. Each card SHALL derive its selection and pending state only from its matching authorization model, and changing either scope SHALL NOT grant, revoke, or otherwise mutate the other scope or active control. Agent installation state SHALL continue to gate conversation suggestions, history, composition, and other Agent operations, but SHALL NOT hide either authorization card or change either current scope. When the Agent is ready, the welcome state SHALL show exactly four independent card rows in this order: summarize page, operate page, Automation authorization, and Fetch authorization. Selecting an Agent SHALL NOT itself grant, revoke, or otherwise mutate authorization.

The Fetch card SHALL request Chromium Host Permission only from the user's direct scope selection. Selecting the current-domain choice SHALL authorize only the active eligible HTTP(S) domain and SHALL replace an existing all-domain Fetch grant with that domain-specific grant after the exact permission is available. Selecting all domains SHALL request the supported broad HTTP(S) Host Permissions. When the active tab has no eligible HTTP(S) domain, the current-domain choice SHALL be unavailable and no permission SHALL be granted. Arbitrary domain entry and revocation SHALL remain available in Settings rather than the compact card.

#### Scenario: User selects an unavailable Agent

- **GIVEN** the Native Host and Bridge are connected
- **AND** a supported Agent is visible but not installed
- **WHEN** the user selects that Agent in the side panel
- **THEN** the main panel shows its targeted setup guidance plus independent Automation and Fetch authorization cards
- **AND** Agent suggestions and conversation actions remain unavailable
- **AND** both cards reflect their existing independent scopes and let the user explicitly change the matching scope

#### Scenario: User switches between ready and unavailable Agents

- **GIVEN** the user has explicitly selected automation and Fetch authorization scopes
- **WHEN** the user switches between a ready Agent and an unavailable Agent
- **THEN** both compact authorization cards remain visible
- **AND** both selected authorization scopes are unchanged

#### Scenario: User clears the selected automation scope

- **GIVEN** the compact Automation selector has current tab or all tabs selected
- **WHEN** the user opens the selector and chooses that selected option again
- **THEN** the selected automation authorization scope is cleared
- **AND** no separate release option is present in the selector
- **AND** Fetch authorization and active control are unchanged

#### Scenario: User authorizes the current Fetch domain

- **GIVEN** the active tab has an eligible HTTP(S) domain
- **WHEN** the user selects the current-domain choice in the compact Fetch authorization row
- **THEN** the Extension requests and records only that exact domain authorization
- **AND** an existing all-domain Fetch grant is disabled after the exact domain permission is available
- **AND** automation-tab authorization and active control are unchanged

#### Scenario: User authorizes all Fetch domains

- **GIVEN** the compact Fetch authorization row is visible
- **WHEN** the user selects the all-domain choice
- **THEN** the Extension requests the supported broad HTTP(S) Host Permissions from that direct action
- **AND** it records all-domain Fetch authorization only when the permission request succeeds
- **AND** automation-tab authorization and active control are unchanged

#### Scenario: User clears the selected Fetch scope

- **GIVEN** the compact Fetch selector has current domain or all domains selected
- **WHEN** the user opens the selector and chooses that selected option again
- **THEN** that selected Fetch authorization scope is disabled
- **AND** automation-tab authorization and active control are unchanged

#### Scenario: Current tab has no eligible Fetch domain

- **GIVEN** the active tab is a browser-internal or otherwise unsupported URL
- **WHEN** the compact Fetch authorization row renders
- **THEN** the current-domain choice is unavailable
- **AND** no Fetch or automation authorization is granted

#### Scenario: Ready Agent shows focused suggestions

- **GIVEN** the selected Agent is ready
- **WHEN** the connected welcome state renders
- **THEN** it shows suggestions for summarizing the current page and operating the current page
- **AND** it does not show a separate suggestion for finding specific information on the page
- **AND** the two suggestion cards and two authorization cards form four independent rows
