## Purpose

Define Extension-private browser-tab workspaces that restore the right Agent conversation while preserving Panerelay's separate authorization and control-lease security boundaries.

## Requirements

### Requirement: Each tab has at most one active workspace

Panerelay SHALL associate an eligible Chrome tab with at most one current provider conversation or local draft and SHALL restore that workspace when the tab becomes active.

#### Scenario: Returning to a bound tab

- **WHEN** the user activates a tab bound to a provider conversation
- **THEN** the Side Panel resumes and displays that conversation without changing browser authorization or control ownership

#### Scenario: Activating an unbound tab

- **WHEN** the user activates an eligible tab with no workspace binding
- **THEN** the Side Panel displays a new local draft using the last selected ready provider

#### Scenario: Chrome restarts

- **WHEN** the Chrome session ends and later restarts
- **THEN** tab workspace bindings from the previous session are not restored

### Requirement: Page-created related tabs inherit the source workspace

Panerelay SHALL copy a workspace binding to a newly created eligible tab only when Chrome reports that the bound source page created the tab as a navigation target. A tab created through browser chrome, keyboard shortcuts, tab-strip controls, or another creation path without that page-navigation signal SHALL remain unbound even if Chrome exposes an opener identifier.

#### Scenario: Bound tab opens a related tab

- **WHEN** a bound page opens a new eligible navigation target and Chrome reports the source relationship
- **THEN** the new tab inherits the same provider conversation workspace

#### Scenario: Browser creates a new tab

- **WHEN** the user creates a tab through the browser UI or a keyboard command without a page-created navigation-target event
- **THEN** Panerelay leaves the new tab unbound

#### Scenario: Related tab outlives its source

- **WHEN** the original tab closes while another related tab remains open
- **THEN** the remaining related tab keeps the conversation workspace until the last related tab closes or the user starts a different workspace

### Requirement: Starting fresh detaches only the active tab

Panerelay SHALL detach the active tab into a new draft workspace when the user starts a new conversation from a group of related tabs. The prior conversation binding SHALL remain unchanged for every sibling tab, and later updates to either workspace SHALL not replace the other.

#### Scenario: Starting fresh from one related tab

- **WHEN** two or more related tabs share a conversation and the user starts a new conversation from one active tab
- **THEN** only that tab receives a new draft while every sibling tab keeps the shared conversation

#### Scenario: First send after detaching

- **WHEN** the user sends the first message from the detached draft
- **THEN** Panerelay binds the new provider conversation only to the detached tab and leaves the sibling conversation unchanged

#### Scenario: Sibling conversation continues

- **WHEN** the prior conversation emits output after another tab detached into a new draft or conversation
- **THEN** Panerelay retains that output with the sibling workspace and does not render it in the detached tab

### Requirement: Workspace updates fail closed

Panerelay SHALL reject stale or conflicting workspace updates and SHALL NOT let an inactive Side Panel replace the binding for a newer active-tab workspace.

#### Scenario: Active tab changes during resume

- **WHEN** a conversation resume started for one tab completes after another tab became active
- **THEN** Panerelay does not apply the completed resume to the newly active tab

#### Scenario: Existing binding conflicts

- **WHEN** a request attempts to replace a tab binding using stale workspace state
- **THEN** Panerelay rejects the update and preserves the current binding

### Requirement: Workspace identifiers remain private

Panerelay SHALL keep raw Chrome tab identifiers inside the Extension and SHALL NOT add them to the shared Agent protocol, activity stream, prompts, or provider conversation metadata.

#### Scenario: Binding a conversation

- **WHEN** Panerelay records or restores a tab workspace
- **THEN** provider and protocol messages contain only existing opaque conversation identifiers and no raw Chrome tab identifier

### Requirement: Workspace state does not grant browser authority

Panerelay SHALL continue to require explicit site authorization and a current control lease for browser actions regardless of any conversation workspace binding.

#### Scenario: Bound tab lacks authorization

- **WHEN** a bound conversation attempts a browser action on a tab that is no longer authorized
- **THEN** the action fails closed while the conversation binding remains visible for non-browser chat use

#### Scenario: Focus changes

- **WHEN** the user focuses a bound or related tab
- **THEN** focus alone grants neither site authorization nor a browser-control lease
