## MODIFIED Requirements

### Requirement: Missing Native Host guidance is actionable

The Extension SHALL distinguish a recognized missing Chromium Native Messaging Host from a transient disconnected state and SHALL show a compact localized setup guide with the supported setup command and a retry action in Chrome and Edge.

#### Scenario: Chrome or Edge cannot find the Native Host

- **GIVEN** the Extension receives a recognized Chromium Native Messaging host-not-found failure
- **WHEN** the side panel renders its readiness state
- **THEN** it explains that the Panerelay local integration is not installed for the current browser, shows `npx --yes @panerelay/setup`, and provides a retry action

#### Scenario: Connection is transiently unavailable

- **GIVEN** the Native Host was installed but the connection closed or is reconnecting
- **WHEN** the side panel renders its readiness state
- **THEN** it presents a connection recovery state without claiming that installation is definitely missing

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
