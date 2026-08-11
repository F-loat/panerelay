## MODIFIED Requirements

### Requirement: Public metadata queries preempt normal command behavior

An explicit top-level help or version query SHALL be handled before a public command starts normal operation. A metadata query MUST NOT grant site permission, authorize or select a target, create a browser participant, acquire a control lease, start a child process, or change a saved browser or integration default.

#### Scenario: Setup metadata is queried in isolation

- **GIVEN** no Panerelay integration state exists in an isolated user directory
- **WHEN** the user invokes `panerelay-setup` with a help or version alias
- **THEN** it returns the requested metadata successfully
- **AND** it creates, removes, or changes no integration files

#### Scenario: CLI metadata is queried before a command

- **GIVEN** the Panerelay CLI is installed
- **WHEN** the user invokes `panerelay` with a top-level help or version alias
- **THEN** the CLI returns the requested metadata successfully
- **AND** it does not run a site adapter, send a Fetch request, select a browser, or change saved state
