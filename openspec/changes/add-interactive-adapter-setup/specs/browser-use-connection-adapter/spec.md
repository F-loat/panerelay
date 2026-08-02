# Delta for browser-use-connection-adapter

## Modified Requirements

### Requirement: Setup's Browser Use default choice is reversible and side-effect free

When setup installs Browser Use as part of the interactive flow, it SHALL save Extension mode only when the user selected Panerelay as the default; otherwise it SHALL save Direct mode. Either write SHALL affect only Panerelay-owned adapter preferences and SHALL not start Browser Harness, mint a CDP ticket, allocate a participant, authorize a target, or modify Browser Use's own configuration. Existing explicit `--browser-use` setup behavior SHALL remain unchanged.

#### Scenario: Interactive Browser Use default accepted

- **GIVEN** Browser Use is selected interactively and its default prompt is accepted
- **WHEN** setup installs the adapter
- **THEN** the saved `browser-use` mode is `extension`
- **AND** no Browser Harness daemon or participant is started

#### Scenario: Interactive Browser Use default declined

- **GIVEN** Browser Use is selected interactively and its default prompt is declined
- **WHEN** setup installs the adapter
- **THEN** the saved `browser-use` mode is `direct`
- **AND** Panerelay-owned Browser Use artifacts are still installed
