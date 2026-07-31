## MODIFIED Requirements

### Requirement: Users can inspect and manage the saved default

Panerelay SHALL provide an engine-neutral standalone CLI that lists live registrations, identifies the saved default, sets a default by exact registration ID or unambiguous browser family, and clears the default. These commands SHALL NOT alter browser permissions or active participants and SHALL be available through either the optional global `panerelay` executable or an explicit `npx` invocation of `@panerelay/cli`.

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

- **GIVEN** a saved browser default exists
- **WHEN** the user clears it
- **THEN** future participants use the single-ready-browser rule or fail on ambiguity
- **AND** active participants and browser authorization remain unchanged

#### Scenario: User chooses an invocation mode

- **GIVEN** browser administration is independent of setup and automation engines
- **WHEN** the user invokes a browser command through a globally installed `panerelay` executable or `npx --yes @panerelay/cli`
- **THEN** both modes operate on the same protected browser registry and saved default
