## ADDED Requirements

### Requirement: Fetch adapter lifecycle output is localized

The setup CLI SHALL localize help, argument errors, installed-adapter listings, add results, remove results, absent-adapter results, and remediation for fetch-adapter lifecycle operations in English and Simplified Chinese. Because setup is the default invocation rather than a required subcommand, the help command list SHALL omit a redundant `setup` entry while keeping the default invocation in usage. Adapter IDs, paths, versions, commands, and machine-readable manifest values SHALL remain unchanged.

#### Scenario: Chinese adapter help is requested

- **GIVEN** Simplified Chinese is selected
- **WHEN** the user runs `npx --yes @panerelay/setup add --help`
- **THEN** setup shows localized single, batch, all-built-in, and local-directory installation guidance

#### Scenario: Batch installation succeeds

- **GIVEN** English is selected and multiple valid adapters are requested
- **WHEN** setup completes their installation
- **THEN** it reports every installed adapter ID and version in deterministic order
- **AND** it prints a localized summary without claiming that browser permission was granted

#### Scenario: Machine-readable adapter source is inspected

- **GIVEN** either supported language is selected
- **WHEN** setup validates or lists an adapter manifest
- **THEN** manifest identifiers, protocol versions, command names, argument names, and field names retain their canonical values
