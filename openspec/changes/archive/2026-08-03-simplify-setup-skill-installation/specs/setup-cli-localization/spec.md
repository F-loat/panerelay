## ADDED Requirements

### Requirement: Interactive setup uses one integration selection and one default confirmation

When setup is run interactively without explicit automation-integration flags, Panerelay SHALL ask one localized multiselect covering agent-browser, Browser Use, and Playwright CLI. If the user selects agent-browser and/or Browser Use, it SHALL then ask one localized confirmation that applies the user-level Panerelay default to every selected default-capable integration. It SHALL NOT ask per-engine installation or per-engine default questions. Playwright SHALL remain explicitly connected and SHALL NOT be included in the user-default change.

#### Scenario: User selects multiple integrations interactively

- **GIVEN** setup has an interactive terminal and no integration flags were supplied
- **WHEN** the user selects agent-browser, Browser Use, and Playwright CLI in the multiselect
- **THEN** setup manages all three selected Panerelay integrations
- **AND** it asks only one additional yes-or-no question about defaults

#### Scenario: User selects only Playwright interactively

- **GIVEN** setup has an interactive terminal and no integration flags were supplied
- **WHEN** the user selects only Playwright CLI
- **THEN** setup manages the Playwright integration without asking a default question
- **AND** Playwright remains an explicit CDP connection

#### Scenario: Explicit flags are supplied

- **GIVEN** setup receives one or more integration flags or a non-interactive option
- **WHEN** setup runs
- **THEN** it uses the supplied selection without presenting the multiselect
- **AND** it changes user defaults only when `--global-default` was supplied
