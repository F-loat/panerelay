## ADDED Requirements

### Requirement: Authorization scope selection and lease release are independent

Panerelay SHALL present the current-tab and all-tabs authorization scopes as explicit toggle selections. Activating or clearing a scope SHALL revoke any current control lease, while the separate release action SHALL revoke the complete control lease without changing the selected authorization scope or Chrome site permission.

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

#### Scenario: Release is used without an active lease

- **GIVEN** an authorization scope is selected and no control lease exists
- **WHEN** the user activates the release action
- **THEN** Panerelay leaves the selected scope unchanged and does not acquire control, expose a new target, or widen authorization

## MODIFIED Requirements

### Requirement: Terminal sessions never revive

Panerelay SHALL require a newly allocated participant ID and credential after that participant is released, expired, or failed. Ending one participant SHALL NOT terminate other responsive participants, while explicit authorization-scope revocation or a user-requested whole-lease release SHALL terminate the complete shared lease.

#### Scenario: Stale participant reconnects

- **GIVEN** a prior participant reached a terminal state
- **WHEN** a client reconnects with its former credential
- **THEN** Panerelay rejects the connection without restoring its participant state or virtual target sessions

#### Scenario: Provider releases one participant

- **GIVEN** multiple participants share the active browser control lease
- **WHEN** one Provider closes its participant
- **THEN** Panerelay disconnects that participant and keeps the other participants and their target sessions live

#### Scenario: User releases browser control

- **GIVEN** one or more participants share the active browser control lease and an authorization scope is selected
- **WHEN** the user activates the whole-lease release action
- **THEN** Panerelay terminates every participant and detaches every observed or controlled target immediately without clearing the selected authorization scope

#### Scenario: User clears browser authorization

- **GIVEN** one or more participants share the active browser control lease
- **WHEN** the user clears the selected authorization scope
- **THEN** Panerelay terminates every participant, detaches every observed or controlled target immediately, and leaves no target eligible for a new participant

### Requirement: Observation and control share revocation

Panerelay SHALL detach both observed and controlled targets when their final participant reference ends, the user releases the complete browser-control lease, or the user clears or changes the selected authorization scope.

#### Scenario: Complete lease is released

- **GIVEN** the lease contains observed and controlled debugger attachments
- **WHEN** the user releases browser control, clears or changes the authorization scope, or the final participant ends
- **THEN** Panerelay detaches every attachment, clears both counts, and restores any surviving controlled-page favicon
