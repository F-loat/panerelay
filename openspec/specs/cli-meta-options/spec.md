# cli-meta-options Specification

## Purpose

Define Panerelay's intentional public command-line surface and predictable, side-effect-free help and version discovery for its human-facing commands.

## Requirements

### Requirement: Public executable surface is intentional

Published Panerelay package manifests SHALL expose exactly `panerelay` and `panerelay-setup` as npm `bin` command names. Machine-oriented adapter, Native Host, and installer entry points MUST NOT be exposed as npm commands; supported integrations SHALL invoke their internal artifacts through setup-managed launchers, package APIs, or package maintenance scripts.

#### Scenario: Published packages expose only user-facing commands

- **GIVEN** the publishable Panerelay package manifests
- **WHEN** their npm `bin` declarations are enumerated
- **THEN** the complete command set is `panerelay` and `panerelay-setup`
- **AND** no adapter, Native Host, or Host installer command is declared

#### Scenario: Setup installs machine-oriented integrations

- **GIVEN** a user configures Native Messaging or Playwright integration through `panerelay-setup`
- **WHEN** setup registers the integration
- **THEN** it installs or selects the private launcher used by that integration
- **AND** it registers that exact launcher path without relying on a public npm command

#### Scenario: Internal Host maintenance remains available

- **GIVEN** package maintainers invoke the Bridge package's Host installation script
- **WHEN** the package script runs the internal installer entry point
- **THEN** installation or uninstallation proceeds through the existing package API path
- **AND** no public `panerelay-host-install` command is required

### Requirement: Public executables expose consistent version aliases

Both public Panerelay commands SHALL accept `-v` and `--version`. Either alias SHALL print only the version of the package that owns the invoked entry point in `v<semver>` form, then exit successfully.

#### Scenario: User requests a short version

- **GIVEN** either public Panerelay command is installed
- **WHEN** the user invokes it with `-v`
- **THEN** it prints only the owning package version with a `v` prefix
- **AND** it exits with status 0

#### Scenario: User requests a long version

- **GIVEN** either public Panerelay command is installed
- **WHEN** the user invokes it with `--version`
- **THEN** it produces the same version result as `-v`
- **AND** the result contains no command-name prefix
- **AND** it exits with status 0

### Requirement: Public executables expose consistent help aliases

Both public Panerelay commands SHALL accept `-h` and `--help`. Either alias SHALL print localized usage and the supported metadata options, then exit successfully.

#### Scenario: User requests short help

- **GIVEN** either public Panerelay command is installed
- **WHEN** the user invokes it with `-h`
- **THEN** it prints command-appropriate usage including the help and version aliases
- **AND** it exits with status 0

#### Scenario: User requests long help

- **GIVEN** either public Panerelay command is installed
- **WHEN** the user invokes it with `--help`
- **THEN** it produces the same help result as `-h` in the selected locale
- **AND** it exits with status 0

### Requirement: Public metadata queries preempt normal command behavior

An explicit top-level help or version query SHALL be handled before a public command starts normal operation. Metadata-like arguments after the `panerelay run` child-command separator SHALL remain child arguments and MUST NOT be intercepted. A metadata query MUST NOT grant site permission, authorize or select a target, create a browser participant, acquire a control lease, or change a saved browser or integration default.

#### Scenario: Setup metadata is queried in isolation

- **GIVEN** no Panerelay integration state exists in an isolated user directory
- **WHEN** the user invokes `panerelay-setup` with a help or version alias
- **THEN** it returns the requested metadata successfully
- **AND** it creates, removes, or changes no integration files

#### Scenario: Child command receives its own metadata option

- **GIVEN** `panerelay run` has received the `--` child-command separator
- **WHEN** the child command arguments contain `-h`, `--help`, `-v`, or `--version`
- **THEN** Panerelay passes those arguments to the child unchanged
- **AND** it does not turn the invocation into a Panerelay metadata query
