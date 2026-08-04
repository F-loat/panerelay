## MODIFIED Requirements

### Requirement: Authorization scope selection and lease release are independent

Panerelay SHALL present the current-tab and all-tabs authorization scopes as explicit toggle selections. Activating or clearing a scope SHALL revoke any current control lease, while the separate release action SHALL revoke the complete control lease without changing the selected authorization scope or Chrome site permission. The Extension SHALL expose that same whole-lease release action in browser access settings and in the Extension action icon's context menu.

#### Scenario: User activates an unselected scope

- **GIVEN** the requested authorization scope is not selected
- **WHEN** the user selects current-tab or all-tabs and completes any required Chrome permission prompt
- **THEN** Panerelay selects that scope, revokes any lease created under the previous scope, and exposes only targets eligible under the new scope

#### Scenario: User toggles off the selected current-tab scope

- **GIVEN** current-tab authorization is selected
- **WHEN** the user clicks the selected current-tab control again
- **THEN** Panerelay clears the local authorization selection, revokes the complete control lease if one exists, and does not remove the already granted Chrome site permission

#### Scenario: User toggles off the selected all-tabs scope

- **GIVEN** all-tabs authorization is selected
- **WHEN** the user clicks the selected all-tabs control again
- **THEN** Panerelay clears the local authorization selection, revokes the complete control lease if one exists, and does not remove the already granted Chrome web-origin permissions

#### Scenario: User releases browser control

- **GIVEN** current-tab or all-tabs authorization remains selected
- **WHEN** the user activates the release action
- **THEN** Panerelay revokes the complete control lease and detaches every observed or controlled target while preserving the selected scope and Chrome site permission

#### Scenario: User releases browser control from the action icon

- **GIVEN** the Extension is installed and current-tab or all-tabs authorization remains selected
- **WHEN** the user activates the localized whole-lease release item from the Extension action icon's context menu
- **THEN** Panerelay performs the same complete lease release as the browser access settings action and preserves the selected scope and Chrome site permission

#### Scenario: Release is used without an active lease

- **GIVEN** an authorization scope is selected and no control lease exists
- **WHEN** the user activates the release action
- **THEN** Panerelay leaves the selected scope unchanged and does not acquire control, expose a new target, or widen authorization
