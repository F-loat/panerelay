## ADDED Requirements

### Requirement: Selected conversations reuse related-tab workspace groups

After an explicitly selected conversation resumes successfully, Panerelay SHALL move only the active tab into the existing Extension-private workspace group for the same provider and conversation when one exists. If no live group remains, Panerelay SHALL create a new group bound to that conversation. The move SHALL be revision-checked and SHALL NOT change sibling tabs in the active tab's previous group or any tab already in the selected conversation's group.

#### Scenario: Selected conversation remains open in another tab

- **GIVEN** one or more tabs share a workspace for a resumable provider conversation
- **WHEN** the user selects that conversation from history in a different active tab and provider resume succeeds
- **THEN** Panerelay moves only the active tab into the existing conversation workspace group
- **AND** later workspace updates are shared with every tab in that selected group

#### Scenario: Active tab leaves a multi-tab workspace

- **GIVEN** the active tab has sibling tabs in its current workspace group
- **WHEN** the user successfully resumes another conversation from history
- **THEN** only the active tab leaves its prior group
- **AND** the sibling tabs retain their prior workspace and revision

#### Scenario: Selected conversation has no live tab group

- **GIVEN** a valid retained conversation has no currently bound tab
- **WHEN** the user selects it and provider resume succeeds
- **THEN** Panerelay creates a new Extension-private workspace group for that conversation and binds only the active tab to it

#### Scenario: Side Panel is recreated after a group join

- **GIVEN** the active tab successfully joined a selected conversation's workspace group
- **WHEN** the Side Panel closes and reopens for that tab during the same Chrome session
- **THEN** Panerelay automatically restores the selected conversation workspace and its valid retained timeline
- **AND** it does not require the user to select the conversation again

#### Scenario: Selected conversation resume fails

- **GIVEN** the active tab has a current workspace and the selected conversation belongs to another workspace group
- **WHEN** provider resume or load fails
- **THEN** Panerelay preserves the active tab's current workspace and group membership
- **AND** does not mutate the selected conversation's group

#### Scenario: Workspace revision becomes stale during resume

- **GIVEN** a selected conversation resume is in progress for the active tab
- **WHEN** a newer workspace mutation changes that tab before resume completes
- **THEN** Panerelay rejects the stale group join and preserves the newer workspace

#### Scenario: Group join has no browser authority

- **WHEN** an active tab joins a selected conversation's workspace group
- **THEN** the join grants no site permission, tab authorization, debugger attachment, target ownership, focus, approval authority, or browser-control lease
