# panerelay-cli Specification

## Purpose

Define an engine-neutral Panerelay command-line interface for recurring local browser administration without turning the one-time setup package into a persistent user command.

## Requirements

### Requirement: Panerelay provides a standalone administration CLI

Panerelay SHALL publish an optional `@panerelay/cli` package whose executable name is `panerelay`. The CLI SHALL manage Panerelay browser registrations and routing preferences without depending on an automation engine or providing browser automation commands.

#### Scenario: User installs the CLI globally

- **GIVEN** the user wants a persistent Panerelay administration command
- **WHEN** they install `@panerelay/cli` globally
- **THEN** `panerelay browsers`, `panerelay browser use <selector>`, and `panerelay browser clear` are available
- **AND** the installation does not install or select agent-browser, browser-use, or another automation engine

#### Scenario: User invokes the CLI without installing it globally

- **GIVEN** the user needs an occasional browser-administration command
- **WHEN** they run `npx --yes @panerelay/cli <command>`
- **THEN** the command has the same browser-registry behavior as the global `panerelay` executable

### Requirement: Setup remains a one-time integration surface

`@panerelay/setup` SHALL expose setup, update, doctor, and uninstall behavior without owning recurring browser-administration commands. Setup SHALL NOT silently install `@panerelay/cli` globally or modify the user's shell `PATH`.

#### Scenario: User performs normal setup

- **GIVEN** the user invokes `npx --yes @panerelay/setup`
- **WHEN** setup completes
- **THEN** the Native Host, Provider registration, and Agent Skill are installed as requested
- **AND** no global Panerelay CLI or shell-path modification is added

#### Scenario: User requests a browser command from setup

- **GIVEN** browser administration has moved to `@panerelay/cli`
- **WHEN** the user supplies `browsers` or `browser use` to `@panerelay/setup`
- **THEN** setup rejects the command as unsupported
- **AND** its help keeps browser administration outside the setup command catalog

### Requirement: Browser administration is localized and bounded

The Panerelay CLI SHALL support English and Simplified Chinese human-readable help, argument errors, browser listings, and default-management results. It SHALL expose only bounded registration metadata and SHALL NOT print bearer credentials or change permissions, targets, participants, or control leases.

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

#### Scenario: User clears the saved default

- **GIVEN** a saved browser preference exists
- **WHEN** the user runs `panerelay browser clear`
- **THEN** the saved routing preference is removed without requiring a live browser
- **AND** browser permissions, authorization, targets, active participants, and control leases remain unchanged

#### Scenario: Browser selector conflicts with ambient process state

- **GIVEN** the process environment contains a different browser selector
- **WHEN** the user supplies an explicit selector to `panerelay browser use`
- **THEN** the CLI applies the command argument
- **AND** it does not save the ambient selector instead
