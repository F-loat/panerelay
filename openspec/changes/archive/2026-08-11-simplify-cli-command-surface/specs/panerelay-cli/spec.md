## MODIFIED Requirements

### Requirement: Panerelay provides a standalone administration CLI

Panerelay SHALL publish `@panerelay/cli` with the executable name `panerelay`. Base Setup SHALL provide the normal global installation. The CLI SHALL expose recurring browser-authenticated Fetch, installed site commands, connected-browser listing and selection, and installed connection-mode selection without embedding an automation engine or implementing browser automation commands. It SHALL NOT expose child-process wrappers, one-shot connection-material resolution, or a CLI command for clearing the saved browser default.

#### Scenario: Base Setup provides the CLI

- **GIVEN** the user follows the documented base Setup path
- **WHEN** Setup completes without `--no-cli`
- **THEN** the global `panerelay` command is available for Fetch, site adapters, browser listing and selection, and connection-mode selection
- **AND** Setup does not install an upstream automation engine

#### Scenario: Removed low-level command is requested

- **GIVEN** the user invokes `panerelay browser clear`, `panerelay connection resolve`, or `panerelay run`
- **WHEN** the CLI parses the invocation
- **THEN** it rejects the removed command as unknown
- **AND** it does not select a browser, resolve connection material, start a child process, or change saved state

#### Scenario: Help presents the supported product path

- **GIVEN** the user invokes `panerelay`, `panerelay -h`, or `panerelay --help`
- **WHEN** localized help is rendered
- **THEN** it presents site adapters, browser-authenticated Fetch, connected-browser selection, base Setup, and `setup add`
- **AND** it omits removed commands and temporary `npx @panerelay/cli` usage

### Requirement: CLI connection commands preserve defaults and credentials

The CLI SHALL allow a user to save a supported Direct or Extension mode for one installed connection adapter. Saving a mode SHALL update only Panerelay-owned preference and integration environment state, SHALL NOT resolve or print short-lived connection material, and SHALL NOT start an automation process. Browser Use Extension mode SHALL select the fixed Panerelay gateway through its managed environment; Direct mode SHALL remove only Panerelay-managed Browser Harness environment keys.

#### Scenario: User selects Browser Use Extension mode

- **GIVEN** the Browser Use integration is installed
- **WHEN** the user runs `panerelay connection use browser-use extension`
- **THEN** Panerelay saves Extension mode and writes the fixed gateway environment owned by the integration
- **AND** it does not select a browser, mint a bootstrap ticket, or start Browser Use

#### Scenario: User selects Browser Use Direct mode

- **GIVEN** the Browser Use integration is installed in Extension mode
- **WHEN** the user runs `panerelay connection use browser-use direct`
- **THEN** Panerelay saves Direct mode and removes only the Panerelay-managed Browser Harness environment keys
- **AND** it leaves unrelated Browser Use state unchanged

### Requirement: Browser administration is localized and bounded

The Panerelay CLI SHALL support English and Simplified Chinese human-readable help, argument errors, browser listings, and browser-selection results. It SHALL expose only bounded registration metadata and SHALL NOT print bearer credentials or change permissions, targets, participants, or control leases. Clearing a saved browser default SHALL remain available through the Extension settings surface rather than a CLI command.

#### Scenario: User lists connected browsers

- **GIVEN** multiple browser registrations are live
- **WHEN** the user runs `panerelay browsers`
- **THEN** the selected locale is used for presentation
- **AND** the output contains browser names, families, opaque registration IDs, readiness, and the saved-default marker
- **AND** it contains no relay token

#### Scenario: User selects the saved default

- **GIVEN** an exact registration ID or unambiguous browser family selects one live ready browser
- **WHEN** the user runs `panerelay browser use <selector>`
- **THEN** only the routing preference changes
- **AND** browser permissions, authorization, targets, active participants, and control leases remain unchanged

#### Scenario: User clears the default in Extension settings

- **GIVEN** the current browser is the saved default
- **WHEN** the user clears that setting in the Panerelay Extension
- **THEN** the saved routing preference is removed
- **AND** browser permissions, authorization, targets, active participants, and control leases remain unchanged

#### Scenario: Browser selector conflicts with ambient process state

- **GIVEN** the process environment contains a different browser selector
- **WHEN** the user supplies an explicit selector to `panerelay browser use`
- **THEN** the CLI applies the command argument
- **AND** it does not save the ambient selector instead
