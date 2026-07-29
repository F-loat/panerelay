## Purpose

Define a page-local visual indicator for active agent-browser control without changing tab
authorization or automation semantics.

## ADDED Requirements

### Requirement: Actively controlled pages are identifiable

PaneRelay SHALL replace the favicon of an actively controlled supported page with the agent-browser
mark and a green control-status dot.

#### Scenario: Agent attaches an authorized target

- **GIVEN** the user authorized a supported page and agent-browser owns the current control lease
- **WHEN** PaneRelay attaches Chrome's debugger to that target
- **THEN** the page favicon shows the agent-browser control variant

#### Scenario: Tab is only authorized

- **GIVEN** a supported tab is eligible under current browser authorization
- **WHEN** agent-browser only discovers the tab without sending a target-scoped command
- **THEN** PaneRelay leaves the page favicon unchanged

### Requirement: The indicator follows the controlled document

PaneRelay SHALL reapply the controlled favicon after an authorized controlled target navigates and
SHALL prevent page runtime updates from replacing it while the document remains controlled.

#### Scenario: Controlled target navigates

- **GIVEN** a target already displays the agent-browser control favicon
- **WHEN** the page navigates to another origin still covered by current authorization
- **THEN** PaneRelay applies the control favicon to the new top-level document

#### Scenario: Controlled SPA rewrites its icon

- **GIVEN** a controlled document displays the agent-browser control favicon
- **WHEN** page code adds another page-owned favicon link
- **THEN** PaneRelay removes the replacement and keeps the control favicon visible

### Requirement: Release restores page identity

PaneRelay SHALL remove its controlled favicon and restore the page-owned favicon nodes when control
of a surviving page ends.

#### Scenario: Provider releases its target

- **GIVEN** a controlled page had one or more page-owned favicon nodes before attachment
- **WHEN** agent-browser detaches the target or releases the complete session
- **THEN** PaneRelay removes its indicator and restores the captured favicon nodes

#### Scenario: Chrome displaces the debugger

- **GIVEN** a controlled page remains open
- **WHEN** Chrome detaches PaneRelay's debugger
- **THEN** PaneRelay attempts restoration without reacquiring control

### Requirement: Indicator failure does not grant or deny control

PaneRelay SHALL treat favicon injection and restoration as best-effort presentation operations
bounded by existing Chrome origin permissions.

#### Scenario: Chrome rejects script injection

- **GIVEN** an otherwise valid control lease and authorized target
- **WHEN** Chrome rejects favicon script injection
- **THEN** PaneRelay continues normal CDP routing and retains the toolbar and side-panel indicators

#### Scenario: Origin is not authorized

- **GIVEN** a tab is outside current optional host permissions
- **WHEN** it is discovered by Chrome
- **THEN** PaneRelay neither controls the tab nor injects the favicon indicator
