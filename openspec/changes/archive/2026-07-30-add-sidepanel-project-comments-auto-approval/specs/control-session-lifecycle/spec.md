## ADDED Requirements

### Requirement: Virtual target bootstrap does not imply page control

Panerelay SHALL keep target discovery, flattened page-session creation, and page-scoped child-target bootstrap virtual until a substantive command accesses or operates the target page.

#### Scenario: A new target receives only bootstrap setup

- **GIVEN** agent-browser discovers or creates an eligible browser tab
- **WHEN** it creates a flattened page session and configures page-scoped auto-attach without requesting page content, navigation, or interaction
- **THEN** Panerelay does not attach Chrome's debugger, increase the controlled-target or controlled-tab count, or replace that page's favicon

#### Scenario: The target receives its first substantive page command

- **GIVEN** a virtual page session has deferred child-target bootstrap settings
- **WHEN** the Agent sends a command that reads, navigates, or interacts with the page
- **THEN** Panerelay attaches the target, replays the bootstrap settings before the page command, reports one controlled target, and marks the current document favicon

#### Scenario: Protocol setup runs on an already controlled target

- **GIVEN** a target is already debugger-attached and its current document is not marked
- **WHEN** Panerelay forwards Target-domain setup or wakes an auto-attached child session
- **THEN** the setup does not itself replace the top-level page favicon
