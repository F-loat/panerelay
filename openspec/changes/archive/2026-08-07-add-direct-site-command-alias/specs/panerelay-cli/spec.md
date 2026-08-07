## ADDED Requirements

### Requirement: Top-level routing gives built-in commands precedence over site aliases

The Panerelay CLI SHALL resolve its built-in commands and global help/version options before considering a direct site alias. It SHALL consider only an exact installed adapter ID as a direct alias, SHALL NOT treat an unknown command or absolute URL as a direct alias, and SHALL preserve the explicit `fetch` namespace as the disambiguation path for a site ID that conflicts with a built-in command.

#### Scenario: Installed site ID conflicts with a built-in command

- **GIVEN** an installed site adapter ID equals a Panerelay built-in command
- **WHEN** the caller uses that ID as the first operand
- **THEN** the CLI selects the built-in command
- **AND** the caller can address the site only through `panerelay fetch <site> ...`

#### Scenario: Unknown top-level command is supplied

- **GIVEN** the first operand is neither a built-in command nor an installed site adapter ID
- **WHEN** the CLI resolves the invocation
- **THEN** it reports the existing localized unknown-command error
- **AND** it does not select a browser or read Bridge credentials

#### Scenario: Absolute URL omits the fetch namespace

- **GIVEN** the caller supplies an absolute HTTP or HTTPS URL as the first operand
- **WHEN** the CLI resolves the invocation
- **THEN** it does not treat the URL as a direct site alias or raw fetch
- **AND** raw browser fetch remains available through `panerelay fetch <url>`

#### Scenario: Direct command contains a site option named lang

- **GIVEN** an installed site command declares a `--lang` option
- **WHEN** the caller runs `panerelay <site> <command> --lang <value>`
- **THEN** the option is forwarded unchanged to the site command
- **AND** CLI localization remains selectable by placing global `--lang` before the site command operands
