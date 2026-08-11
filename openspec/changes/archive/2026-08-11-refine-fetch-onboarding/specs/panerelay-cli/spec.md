## MODIFIED Requirements

### Requirement: Setup manages the normal global CLI lifecycle without taking over existing installations

`@panerelay/setup` SHALL continue to expose setup, update, doctor, uninstall, and explicit integration behavior without owning recurring browser-administration semantics. A normal setup, install, or update invocation SHALL detect both the current npm-global `@panerelay/cli` package and a PATH-visible non-project `panerelay` command before mutating the Native Host. If no global CLI exists, Setup SHALL install the exact Setup release through structured npm arguments and record protected Setup ownership. A later setup or update SHALL skip an already matching version and SHALL update an older version only when the installed version still matches that ownership record. A pre-existing, externally changed, or alternate-Node-prefix global CLI SHALL be preserved without reinstalling, downgrading, or claiming ownership. A project-local `node_modules/.bin` command SHALL NOT suppress the normal global lifecycle.

Setup SHALL expose `--no-cli` for an explicit base setup without global CLI lifecycle. Uninstall SHALL remove only a CLI whose installed version still matches Setup's ownership record and SHALL expose `--keep-cli`. Adapter `add`, `remove`, and `adapters` operations SHALL NOT install, update, remove, or claim the global CLI. Setup SHALL continue not to edit shell startup files or install upstream automation engines.

#### Scenario: First base setup provides the command

- **GIVEN** no global `@panerelay/cli` installation or Setup ownership record exists
- **WHEN** the user runs base Setup
- **THEN** Setup installs its exact `@panerelay/cli` release before installing the Native Host
- **AND** records protected ownership so later setup and update invocations can keep it in lockstep

#### Scenario: Matching Setup-managed CLI is current

- **GIVEN** the global CLI and Setup ownership record both name the current Setup release
- **WHEN** setup or update runs again
- **THEN** Setup does not invoke a global package installation
- **AND** the existing command remains available

#### Scenario: Setup-managed CLI is updated

- **GIVEN** the global CLI version still matches an older Setup ownership record
- **WHEN** a newer exact Setup release runs setup or update
- **THEN** Setup installs the newer exact CLI release and updates its ownership record

#### Scenario: Existing user installation is preserved

- **GIVEN** a global CLI exists without a matching Setup ownership record
- **WHEN** setup or update runs
- **THEN** Setup reports and preserves that installation without reinstalling or claiming it

#### Scenario: Existing command belongs to another Node prefix

- **GIVEN** `panerelay` is PATH-visible from an NVM, Volta, or npm prefix different from the npm executable currently selected by Setup
- **AND** no matching Setup ownership record exists
- **WHEN** setup or update runs
- **THEN** Setup preserves the existing command without consulting the current prefix for an installation mutation

#### Scenario: Adapter installation remains independent

- **GIVEN** the user runs `npx --yes @panerelay/setup add bilibili`
- **WHEN** the adapter is installed
- **THEN** Setup does not probe or change the global CLI
- **AND** documentation has already instructed the user to run base Setup before adapter installation

#### Scenario: Uninstall preserves user-owned CLI

- **GIVEN** the global CLI has no matching Setup ownership record
- **WHEN** Panerelay uninstall runs
- **THEN** the CLI remains installed
- **AND** only Panerelay-owned local integration files are removed
