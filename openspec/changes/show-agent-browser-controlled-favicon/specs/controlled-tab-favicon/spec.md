## Purpose

Define a page-local visual indicator for active agent-browser control without changing tab
authorization or automation semantics.

## ADDED Requirements

### Requirement: Actively controlled pages are identifiable

Panerelay SHALL replace the favicon of an actively controlled supported page with the agent-browser
mark and a green control-status dot.

#### Scenario: Agent attaches an authorized target

- **GIVEN** the user authorized a supported page and agent-browser owns the current control lease
- **WHEN** Panerelay attaches Chrome's debugger to that target
- **THEN** the page favicon shows the agent-browser control variant

#### Scenario: Tab is only authorized

- **GIVEN** a supported tab is eligible under current browser authorization
- **WHEN** agent-browser only discovers the tab without sending a target-scoped command
- **THEN** Panerelay leaves the page favicon unchanged

### Requirement: The indicator describes Agent activity in the current document

Panerelay SHALL allow navigation to clear the current-document favicon, SHALL reapply it before the
next target-scoped Agent command, and SHALL prevent page runtime updates from replacing it while
that document remains controlled.

#### Scenario: Controlled target navigates or refreshes

- **GIVEN** a target already displays the agent-browser control favicon
- **WHEN** the page navigates or refreshes
- **THEN** the new top-level document starts with its page-owned favicon

#### Scenario: Agent operates on the new document

- **GIVEN** navigation cleared the agent-browser control favicon from an authorized controlled
  target
- **WHEN** agent-browser sends the next target-scoped command
- **THEN** Panerelay reapplies the control favicon to the current top-level document on a
  best-effort basis

#### Scenario: Controlled SPA rewrites its icon

- **GIVEN** a controlled document displays the agent-browser control favicon
- **WHEN** page code adds another page-owned favicon link
- **THEN** Panerelay removes the replacement and keeps the control favicon visible

### Requirement: Release restores page identity

Panerelay SHALL remove its controlled favicon and restore the page-owned favicon nodes when control
of a surviving page ends.

#### Scenario: Provider releases its target

- **GIVEN** a controlled page had one or more page-owned favicon nodes before attachment
- **WHEN** agent-browser detaches the target or releases the complete session
- **THEN** Panerelay removes its indicator and restores the captured favicon nodes

#### Scenario: Chrome displaces the debugger

- **GIVEN** a controlled page remains open
- **WHEN** Chrome detaches Panerelay's debugger
- **THEN** Panerelay attempts restoration without reacquiring control

### Requirement: Indicator failure does not grant or deny control

Panerelay SHALL treat favicon injection and restoration as best-effort presentation operations
bounded by existing Chrome origin permissions.

#### Scenario: Chrome rejects script injection

- **GIVEN** an otherwise valid control lease and authorized target
- **WHEN** Chrome rejects favicon script injection
- **THEN** Panerelay continues normal CDP routing and retains the toolbar and side-panel indicators

#### Scenario: Origin is not authorized

- **GIVEN** a tab is outside current optional host permissions
- **WHEN** it is discovered by Chrome
- **THEN** Panerelay neither controls the tab nor injects the favicon indicator
