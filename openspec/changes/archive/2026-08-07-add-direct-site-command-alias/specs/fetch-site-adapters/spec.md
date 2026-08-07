## ADDED Requirements

### Requirement: Installed site adapters support direct invocation

The Panerelay CLI SHALL accept `panerelay <site> <command> [arguments]` and `panerelay <site> --help` when `<site>` exactly matches an installed site adapter ID. It SHALL route the unchanged site, command, and adapter arguments through the same fetch-adapter help, validation, browser selection, protected process, output, and error paths as `panerelay fetch <site> ...`. The explicit `fetch` form SHALL remain supported.

#### Scenario: User directly invokes an installed site command

- **GIVEN** Bilibili is installed
- **WHEN** the user runs `panerelay bilibili me`
- **THEN** the CLI behaves equivalently to `panerelay fetch bilibili me`
- **AND** it applies the same browser selection, adapter isolation, output, and credential non-disclosure behavior

#### Scenario: User directly requests site help

- **GIVEN** Bilibili is installed and no browser is connected
- **WHEN** the user runs `panerelay bilibili --help`
- **THEN** the CLI renders Bilibili's installed manifest help
- **AND** it does not start the adapter or read Bridge credentials

#### Scenario: Installed adapter registry is unsafe

- **GIVEN** direct site routing encounters a missing, malformed, or unprotected adapter registration
- **WHEN** the caller uses the direct form
- **THEN** the CLI fails closed before adapter execution or browser selection
- **AND** it does not infer an adapter from an ambient package or executable

#### Scenario: Caller uses the explicit form

- **GIVEN** a compatible site adapter is installed
- **WHEN** the caller uses `panerelay fetch <site> <command>`
- **THEN** the existing invocation remains supported without behavioral changes
