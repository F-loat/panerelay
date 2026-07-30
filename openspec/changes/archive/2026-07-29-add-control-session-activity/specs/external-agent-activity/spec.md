## Purpose

Define a bounded and privacy-preserving activity stream that lets users understand external Agent browser work without exposing raw CDP data or granting additional browser access.

## ADDED Requirements

### Requirement: Activity is sanitized by construction

Panerelay SHALL convert routed browser commands into provider-neutral categories and labels without including raw command parameters or results.

#### Scenario: Agent sends a page command

- **GIVEN** an Agent sends a command associated with an authorized virtual target session
- **WHEN** Panerelay creates an activity record
- **THEN** the record contains opaque identifiers, actor, target, category, label, status, sequence, and timestamps only

#### Scenario: Sensitive command data exists

- **GIVEN** a command contains a URL, selector, entered text, cookie, header, request body, storage value, prompt, screenshot, or local file path
- **WHEN** Panerelay emits activity
- **THEN** none of those values or the raw params or result appears in the activity event

### Requirement: Activity has correlated terminal status

Panerelay SHALL emit one started activity for each observed command and correlate it with a completed, failed, or denied terminal update.

#### Scenario: Command completes

- **GIVEN** Panerelay emitted a started activity for a routed command
- **WHEN** the Extension returns the correlated CDP result
- **THEN** Panerelay updates the same activity to completed

#### Scenario: Command is rejected or fails

- **GIVEN** an Agent command is denied by Panerelay policy or fails in Chrome
- **WHEN** Panerelay reports the command error
- **THEN** the same activity reaches denied or failed with a sanitized error summary

### Requirement: Activity history is bounded and sequenced

Panerelay SHALL expose a bounded in-memory activity snapshot with an opaque epoch and increasing sequence numbers.

#### Scenario: Activity exceeds retention

- **GIVEN** the active session produced more activity than the configured in-memory bound
- **WHEN** a new event is appended
- **THEN** Panerelay discards the oldest event without writing it to disk

#### Scenario: Activity history restarts

- **GIVEN** the Extension previously observed an activity epoch or sequence
- **WHEN** the Bridge restarts or the next snapshot begins after an unavailable range
- **THEN** the Extension marks the history as incomplete instead of implying continuous replay

### Requirement: External activity is visible in the side panel

Panerelay SHALL show the current external Agent and recent activity lifecycle in a dedicated side-panel section.

#### Scenario: Agent performs browser work

- **GIVEN** the side panel is open and an external control session is active
- **WHEN** activity events arrive
- **THEN** the panel displays localized category, label, status, and time while keeping immediate release available

#### Scenario: History gap is detected

- **GIVEN** the Extension detects a changed epoch or sequence discontinuity
- **WHEN** the side panel renders recent activity
- **THEN** the panel displays an explicit history-gap notice

### Requirement: Observation does not grant control

Panerelay SHALL keep activity visibility independent from Chrome site permission, tab authorization, and control-lease acquisition.

#### Scenario: Panel observes a session

- **GIVEN** the Extension receives control-session or activity messages
- **WHEN** it stores or renders them
- **THEN** it does not attach another target, widen site access, or renew the Agent lease

#### Scenario: Rendering fails

- **GIVEN** the activity view cannot render or replay its history
- **WHEN** an external Agent still owns control
- **THEN** the user can still use the immediate release action
