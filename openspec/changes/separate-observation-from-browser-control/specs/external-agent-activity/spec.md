## MODIFIED Requirements

### Requirement: External activity is visible in the side panel

Panerelay SHALL show the shared browser control lease, current active participant, participant count, observed-target count, controlled-target count, and recent participant-attributed activity lifecycle in a dedicated side-panel section. Observation SHALL remain visible without being presented as active page control.

#### Scenario: Participants perform browser work

- **GIVEN** the side panel is open and multiple participants share the active control lease
- **WHEN** activity events arrive from different participants
- **THEN** the panel displays localized category, label, status, time, and current actor without requiring authorization or debugger reattachment

#### Scenario: Participant only reads pages

- **GIVEN** an Agent has only enabled observation or issued allowlisted read-only commands
- **WHEN** the side panel renders the session summary
- **THEN** the panel reports observed targets separately and reports zero controlled targets

#### Scenario: Participant begins controlling a page

- **GIVEN** the panel reports a target as observed
- **WHEN** the Agent issues the first control-class command for that target
- **THEN** the panel moves that target from the observed total to the controlled total without double-counting it

#### Scenario: History gap is detected

- **GIVEN** the Extension detects a changed epoch or sequence discontinuity
- **WHEN** the side panel renders recent activity
- **THEN** the panel displays an explicit history-gap notice

## ADDED Requirements

### Requirement: Passive target updates are deduplicated

Panerelay SHALL publish target metadata changes only when the observable target metadata actually changes. Panerelay SHALL serialize publication for each Chrome tab so concurrent creation, activation, and metadata updates produce at most one target-created event for one opaque target.

#### Scenario: Chrome emits an unchanged tab update

- **GIVEN** an eligible target was already published with the same URL, title, type, attachment state, and browser context
- **WHEN** Chrome emits another update that does not change those fields
- **THEN** Panerelay does not emit another target-info-changed event

#### Scenario: Creation and metadata update race

- **GIVEN** Chrome emits tab-created and tab-updated events for the same new tab while asynchronous authorization checks are pending
- **WHEN** Panerelay publishes the tab lifecycle
- **THEN** it emits exactly one target-created event for one opaque target and treats any later changed metadata as a target-info-changed event
