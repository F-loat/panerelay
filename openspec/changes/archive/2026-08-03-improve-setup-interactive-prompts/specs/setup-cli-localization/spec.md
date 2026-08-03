## MODIFIED Requirements

### Requirement: Interactive setup uses one integration selection and one default confirmation

When setup is run interactively without explicit automation-integration flags, Panerelay SHALL present one localized keyboard multiselect covering agent-browser, Browser Use, and Playwright CLI, with each option and its current selection state visible. If the user selects agent-browser and/or Browser Use, it SHALL then ask one localized confirmation that applies the user-level Panerelay default to every selected default-capable integration. It SHALL NOT ask per-engine installation or per-engine default questions. Playwright SHALL remain explicitly connected and SHALL NOT be included in the user-default change. Cancelling either interactive prompt SHALL stop setup before installation state is changed.

#### Scenario: User selects multiple integrations interactively

- **GIVEN** setup has an interactive terminal and no integration flags were supplied
- **WHEN** the user toggles agent-browser, Browser Use, and Playwright CLI in the multiselect and submits it
- **THEN** setup manages all three selected Panerelay integrations
- **AND** it asks only one additional yes-or-no question about defaults

#### Scenario: User selects only Playwright interactively

- **GIVEN** setup has an interactive terminal and no integration flags were supplied
- **WHEN** the user selects only Playwright CLI
- **THEN** setup manages the Playwright integration without asking a default question
- **AND** Playwright remains an explicit CDP connection

#### Scenario: User selects no optional integrations

- **GIVEN** setup has an interactive terminal and no integration flags were supplied
- **WHEN** the user submits the multiselect without selecting an integration
- **THEN** setup manages only the local Native Host integration
- **AND** the result does not print an additional sentence explaining interactive integration flags

#### Scenario: User cancels an interactive prompt

- **GIVEN** setup has an interactive terminal and no integration flags were supplied
- **WHEN** the user cancels the multiselect or the shared default confirmation
- **THEN** setup reports a localized cancellation
- **AND** it does not change installation state

#### Scenario: Explicit flags are supplied

- **GIVEN** setup receives one or more integration flags or a non-interactive option
- **WHEN** setup runs
- **THEN** it uses the supplied selection without presenting the multiselect
- **AND** it changes user defaults only when `--global-default` was supplied
