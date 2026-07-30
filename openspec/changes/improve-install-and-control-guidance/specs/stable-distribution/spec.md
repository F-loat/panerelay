## MODIFIED Requirements

### Requirement: Provider selection is documented as opt-in configuration

Panerelay SHALL keep explicit `--provider panerelay`, project-default, and user-default agent-browser selection controls, including the existing setup CLI options, and SHALL document their precedence and independence from browser authorization. The default README installation command SHALL register Panerelay without selecting it as a default. Documentation SHALL identify Extension settings as an additional way to set or clear the user-level default without uninstalling Panerelay.

#### Scenario: User follows the default installation path

- **GIVEN** Panerelay is not the project-level or user-level default
- **WHEN** the user follows the README installation and verification steps
- **THEN** setup does not change either default and the documented verification command explicitly selects `--provider panerelay`

#### Scenario: User chooses a default Provider scope through setup

- **GIVEN** the user wants Panerelay selected without a command-line Provider flag
- **WHEN** they use the existing project-level or user-level setup option
- **THEN** documentation explains the affected configuration scope and states that no browser tab becomes authorized

#### Scenario: User manages the user-level default in the Extension

- **GIVEN** the Native Host is connected
- **WHEN** the user uses Extension settings to set or clear the Panerelay user-level default
- **THEN** documentation explains that this changes agent-browser configuration without uninstalling Panerelay or granting browser authorization

### Requirement: Beta package versions use one public ordinal

Panerelay SHALL generate beta npm versions as `X.Y.Z-beta.<run-number>`. A retry of the same GitHub Actions workflow run SHALL reuse that npm version, while the next workflow run SHALL advance to the next beta ordinal. Temporary beta metadata SHALL continue to be restored without modifying the repository.

#### Scenario: A new beta workflow run is prepared

- **GIVEN** the repository version is the stable base `0.1.0`
- **WHEN** release workflow run number 2 prepares the beta candidate
- **THEN** every publishable package uses version `0.1.0-beta.2`

#### Scenario: A beta workflow run is retried

- **GIVEN** workflow run number 2 is retried with a higher run-attempt value
- **WHEN** the beta candidate is prepared again
- **THEN** the npm package version remains `0.1.0-beta.2`
