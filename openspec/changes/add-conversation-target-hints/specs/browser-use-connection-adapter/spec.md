## ADDED Requirements

### Requirement: Conversation target hints are directly selectable in Browser Use

Panerelay SHALL expose the Extension-generated opaque target ID in bounded conversation guidance so Browser Use 0.13.7 with Browser Harness 0.1.8 can select it through the unchanged `switch_tab(targetId)` helper. Target selection SHALL retain the existing shared persistent Panerelay daemon lane and MUST NOT create a per-conversation daemon, infer a target from URL/title, or widen the participant's target inventory.

#### Scenario: Hinted target exists in the persistent lane

- **GIVEN** the Browser Use Panerelay lane is connected to the originating browser and exposes the hinted authorized target
- **WHEN** the Agent calls `switch_tab` with the injected opaque target ID
- **THEN** Browser Harness selects that exact target and subsequent helpers address it
- **AND** the shared lane, normal helper behavior, authorization, and control policy remain unchanged

#### Scenario: Persistent lane cannot see the hint

- **GIVEN** the Browser Use lane is pinned to another browser generation or its exposed target set does not contain the hinted target
- **WHEN** the Agent calls `switch_tab` with the injected opaque target ID
- **THEN** the operation fails explicitly
- **AND** Panerelay does not restart the daemon, select another target, or fall back to Direct mode automatically

#### Scenario: Another Agent already uses the shared lane

- **GIVEN** the persistent Browser Use lane is busy or retains another Agent's current-page state
- **WHEN** a conversation attempts to select its hinted target
- **THEN** the existing serialization or busy behavior remains authoritative
- **AND** the target hint does not create a second daemon or claim per-Agent isolation
