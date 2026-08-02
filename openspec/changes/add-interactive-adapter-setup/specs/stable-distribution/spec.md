# Delta for stable-distribution

## Modified Requirements

### Requirement: Default setup offers optional integrations interactively

When the default `setup` operation is invoked without either automation integration flag, Panerelay SHALL enter an interactive selection flow only when stdin and stdout are TTYs. It SHALL ask independently whether to install agent-browser and Browser Use, and for each selected integration ask whether Panerelay should be its user-level default. The agent-browser choice SHALL map to the user-level Panerelay Provider default; the Browser Use choice SHALL map to the saved Extension or Direct adapter mode. The flow SHALL not authorize tabs, start an engine, or change browser ownership.

#### Scenario: Interactive user selects both integrations and both defaults

- **GIVEN** the user runs setup without `--agent-browser` or `--browser-use` in a TTY
- **WHEN** the user selects both integrations and accepts both default prompts
- **THEN** setup installs both selected integrations
- **AND** it configures the user-level agent-browser Provider default
- **AND** it saves Browser Use Extension mode
- **AND** it does not authorize a tab or start Browser Use

#### Scenario: Interactive user installs without selecting defaults

- **GIVEN** the user selects one or both integrations and declines each default prompt
- **WHEN** setup completes
- **THEN** the selected integrations are installed
- **AND** no new user-level agent-browser default is configured
- **AND** Browser Use is saved as Direct mode

#### Scenario: Explicit setup flags remain non-interactive

- **GIVEN** setup receives `--agent-browser`, `--browser-use`, or both
- **WHEN** setup runs
- **THEN** it does not prompt for integration or default choices
- **AND** it preserves the existing explicit-flag behavior

#### Scenario: Non-TTY default setup does not block

- **GIVEN** neither integration flag is supplied and stdin or stdout is not a TTY
- **WHEN** setup runs
- **THEN** it installs only the Native Host and common prerequisites
- **AND** it exits without waiting for input or changing either integration default

#### Scenario: Interactive dependency is unavailable

- **GIVEN** the user selects an integration whose pinned dependency is missing or unsupported
- **WHEN** setup probes that integration
- **THEN** it reports the existing actionable compatibility failure
- **AND** it does not claim the integration or its default was configured
