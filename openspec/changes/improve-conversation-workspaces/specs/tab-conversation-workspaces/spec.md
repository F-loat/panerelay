## Purpose

Define Extension-private browser-tab workspaces that restore the right Agent conversation while preserving PaneRelay's separate authorization and control-lease security boundaries.

## ADDED Requirements

### Requirement: Each tab has at most one active workspace

PaneRelay SHALL associate an eligible Chrome tab with at most one current provider conversation or local draft and SHALL restore that workspace when the tab becomes active.

#### Scenario: Returning to a bound tab

- **WHEN** the user activates a tab bound to a provider conversation
- **THEN** the Side Panel resumes and displays that conversation without changing browser authorization or control ownership

#### Scenario: Activating an unbound tab

- **WHEN** the user activates an eligible tab with no workspace binding
- **THEN** the Side Panel displays a new local draft using the last selected ready provider

#### Scenario: Chrome restarts

- **WHEN** the Chrome session ends and later restarts
- **THEN** tab workspace bindings from the previous session are not restored

### Requirement: Trusted related tabs inherit the source workspace

PaneRelay SHALL copy a workspace binding to a newly created eligible tab only when Chrome reports a trusted opener or navigation-target relationship to a bound source tab.

#### Scenario: Bound tab opens a related tab

- **WHEN** a bound tab opens a new eligible tab and Chrome reports the source relationship
- **THEN** the new tab inherits the same provider conversation workspace

#### Scenario: Unrelated tab is created

- **WHEN** a new tab has no trusted relationship to a bound source tab
- **THEN** PaneRelay leaves the new tab unbound

#### Scenario: Related tab outlives its source

- **WHEN** the original tab closes while another related tab remains open
- **THEN** the remaining related tab keeps the conversation workspace until the last related tab closes or the user starts a different workspace

### Requirement: Workspace updates fail closed

PaneRelay SHALL reject stale or conflicting workspace updates and SHALL NOT let an inactive Side Panel replace the binding for a newer active-tab workspace.

#### Scenario: Active tab changes during resume

- **WHEN** a conversation resume started for one tab completes after another tab became active
- **THEN** PaneRelay does not apply the completed resume to the newly active tab

#### Scenario: Existing binding conflicts

- **WHEN** a request attempts to replace a tab binding using stale workspace state
- **THEN** PaneRelay rejects the update and preserves the current binding

### Requirement: Workspace identifiers remain private

PaneRelay SHALL keep raw Chrome tab identifiers inside the Extension and SHALL NOT add them to the shared Agent protocol, activity stream, prompts, or provider conversation metadata.

#### Scenario: Binding a conversation

- **WHEN** PaneRelay records or restores a tab workspace
- **THEN** provider and protocol messages contain only existing opaque conversation identifiers and no raw Chrome tab identifier

### Requirement: Workspace state does not grant browser authority

PaneRelay SHALL continue to require explicit site authorization and a current control lease for browser actions regardless of any conversation workspace binding.

#### Scenario: Bound tab lacks authorization

- **WHEN** a bound conversation attempts a browser action on a tab that is no longer authorized
- **THEN** the action fails closed while the conversation binding remains visible for non-browser chat use

#### Scenario: Focus changes

- **WHEN** the user focuses a bound or related tab
- **THEN** focus alone grants neither site authorization nor a browser-control lease
