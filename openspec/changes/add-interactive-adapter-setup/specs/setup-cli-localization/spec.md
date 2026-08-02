# Delta for setup-cli-localization

## Modified Requirements

### Requirement: Interactive setup prompts are localized and bounded

The setup CLI SHALL localize every interactive integration and default-selection prompt in English and Simplified Chinese. Prompts SHALL use explicit yes/no choices with a safe default, and non-interactive invocations SHALL never wait for input. The selected locale SHALL not change parsed flags, preference keys, or machine-readable diagnostics.

#### Scenario: Chinese interactive setup

- **GIVEN** a TTY setup invocation with `--lang zh-CN` and no integration flags
- **WHEN** the CLI asks about integrations and defaults
- **THEN** all prompt text and choice labels are Simplified Chinese
- **AND** the resulting setup options are the same as the equivalent English answers

#### Scenario: Non-interactive setup skips prompts

- **GIVEN** setup is invoked with `--yes` or `--non-interactive`
- **WHEN** no integration flags are supplied
- **THEN** no prompt is emitted and setup proceeds with the base-only selection

#### Scenario: Prompt input is invalid or unavailable

- **GIVEN** an interactive prompt receives an answer other than the accepted yes/no forms
- **WHEN** the CLI evaluates the answer
- **THEN** it uses the documented safe default or reprompts without changing unrelated selections
