## MODIFIED Requirements

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

### Requirement: External activity is visible in the side panel

Panerelay SHALL show the shared browser control lease, current active participant, participant count, and recent participant-attributed activity lifecycle in a dedicated side-panel section.

#### Scenario: Participants perform browser work

- **GIVEN** the side panel is open and multiple participants share the active control lease
- **WHEN** activity events arrive from different participants
- **THEN** the panel displays localized category, label, status, time, and current actor without requiring authorization or debugger reattachment

#### Scenario: History gap is detected

- **GIVEN** the Extension detects a changed epoch or sequence discontinuity
- **WHEN** the side panel renders recent activity
- **THEN** the panel displays an explicit history-gap notice

## ADDED Requirements

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
