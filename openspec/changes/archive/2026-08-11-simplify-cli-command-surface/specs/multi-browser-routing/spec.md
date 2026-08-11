## MODIFIED Requirements

### Requirement: Users can inspect and manage the saved default

Panerelay SHALL provide an engine-neutral standalone CLI that lists live registrations, identifies the saved default, and sets a default by exact registration ID or unambiguous browser family. Base Setup SHALL provide that CLI as the global `panerelay` executable. Clearing the saved default SHALL remain available through Extension settings. These surfaces SHALL NOT alter browser permissions or active participants.

#### Scenario: User lists browsers

- **GIVEN** Chrome and Edge are registered
- **WHEN** the user lists Panerelay browsers
- **THEN** the CLI shows their browser families, opaque registration IDs, readiness, and which registration is the saved default

#### Scenario: User sets an unambiguous default

- **GIVEN** one live Edge registration exists
- **WHEN** the user selects Edge as the default
- **THEN** Panerelay saves that registration ID for future unscoped participants
- **AND** existing participants remain pinned to their original browsers

#### Scenario: User clears the default

- **GIVEN** the current browser is the saved default
- **WHEN** the user clears that setting in the Panerelay Extension
- **THEN** future participants use the single-ready-browser rule or fail on ambiguity
- **AND** active participants and browser authorization remain unchanged

#### Scenario: User invokes the Setup-provided CLI

- **GIVEN** base Setup has provided the global `panerelay` executable
- **WHEN** the user runs `panerelay browsers` or `panerelay browser use <selector>`
- **THEN** the command operates on the protected browser registry and saved default
- **AND** no temporary `npx @panerelay/cli` invocation is required
