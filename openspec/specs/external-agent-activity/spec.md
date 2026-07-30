# external-agent-activity Specification

## Purpose

Define a bounded and privacy-preserving activity stream that lets users understand external Agent browser work without exposing raw CDP data or granting additional browser access.

## Requirements

### Requirement: Activity is sanitized by construction

Panerelay SHALL convert routed browser commands into provider-neutral categories and labels, attribute each record to the authenticated participant that issued the command, and exclude raw command parameters or results.

#### Scenario: Participant sends a page command

- **GIVEN** a participant sends a command associated with its authorized virtual target session
- **WHEN** Panerelay creates an activity record
- **THEN** the record contains opaque identifiers, participant actor, target, category, label, status, sequence, and timestamps only

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

### Requirement: Participant command streams remain isolated

Panerelay SHALL keep each participant's virtual CDP sessions, pending results, and activity correlation isolated while serializing target-scoped forwarding that could otherwise overlap on the same Chrome target.

#### Scenario: Two participants inspect one target

- **GIVEN** two participants have independent virtual sessions for the same authorized target
- **WHEN** both issue target-scoped commands
- **THEN** Panerelay returns each correlated result only to its originating participant

#### Scenario: Commands overlap on one target

- **GIVEN** a command from one participant is in flight on an authorized target
- **WHEN** another participant sends a command for the same target
- **THEN** Panerelay queues the second command until the first reaches a terminal result

#### Scenario: Participant disconnects with queued work

- **GIVEN** a participant has pending or queued commands
- **WHEN** that participant disconnects
- **THEN** Panerelay fails only its work and does not deliver or replay it to another participant

### Requirement: Agent target selection does not steal user focus

Panerelay SHALL keep each participant's logical selected target separate from Chrome's user-visible active tab and SHALL suppress ordinary Agent operations that would otherwise activate a Chrome tab or focus a Chrome window.

#### Scenario: Participant selects an existing tab

- **GIVEN** the user is viewing one authorized Chrome tab and the participant knows another authorized target
- **WHEN** agent-browser selects the other target through `tab <id>`
- **THEN** subsequent commands use that target while the user's visible Chrome tab and window focus remain unchanged

#### Scenario: Page requests foreground activation

- **GIVEN** a participant controls an authorized background target
- **WHEN** agent-browser sends `Target.activateTarget` or `Page.bringToFront`
- **THEN** Panerelay acknowledges the logical selection without activating the Chrome tab or focusing its window

#### Scenario: Participant creates a tab

- **GIVEN** all-tabs authorization permits target creation
- **WHEN** a participant creates a target
- **THEN** Panerelay creates it in the background, makes it the participant's logical target, and preserves the user's visible Chrome tab and window focus

#### Scenario: Participant closes its logical target

- **GIVEN** a participant selected a background target
- **WHEN** the participant closes it
- **THEN** Chrome removes that target without Panerelay activating a replacement tab on the user's behalf
