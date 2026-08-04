## ADDED Requirements

### Requirement: Setup completion output focuses on applied components

Panerelay setup SHALL report the Native Host, selected automation integrations, and final setup state. It SHALL NOT render a separate optional-tools group for Codex, Qoder, Claude Code, or OpenCode discovery; those environment diagnostics remain available through doctor.

#### Scenario: Optional Agent tools are present or absent

- **GIVEN** setup has completed and optional Agent executables may be present or missing
- **WHEN** the CLI renders setup results
- **THEN** it omits optional-tool paths, versions, missing-tool warnings, and remediation
- **AND** it still renders the local integration, explicitly selected automation integrations, and final setup state

## MODIFIED Requirements

### Requirement: Interactive setup uses one integration selection and one default confirmation

When setup is run interactively without explicit automation-integration flags, Panerelay SHALL present one localized keyboard multiselect covering agent-browser, Browser Use, and Playwright CLI, with each currently configured Panerelay Provider or adapter registration initially selected. The prompt SHALL state that checked integrations are installed or updated and unchecked Panerelay-owned integrations are removed. Panerelay MUST derive initial selections only from valid protected Panerelay configuration and MUST NOT infer them from executable discovery alone. If the user selects agent-browser and/or Browser Use, it SHALL then ask one localized confirmation that applies the user-level Panerelay default state to every selected default-capable integration. That confirmation SHALL initialize to `Yes` only when every selected default-capable integration currently uses Panerelay as its default, and otherwise SHALL initialize to `No`. It SHALL NOT ask per-engine installation or per-engine default questions. Playwright SHALL remain explicitly connected and SHALL NOT be included in the user-default change.

The submitted interactive selection SHALL be the desired Panerelay integration state. Checked integrations SHALL be installed or updated. Unchecked integrations SHALL have only their Panerelay-owned Provider, adapter, configuration, and Panerelay default artifacts removed; upstream automation engines and unrelated user configuration MUST remain unchanged. The submitted default answer SHALL set or conditionally clear the Panerelay defaults for selected default-capable integrations. Because successful reconciliation makes protected configuration match the submitted selection, the next interactive run SHALL reproduce that state without a separate setup-selection cache. Cancellation or a thrown lifecycle failure MUST NOT create a new selection record. Invalid or unprotected current configuration MUST NOT drive setup and MUST NOT grant browser authorization, create an automation participant, acquire a control lease, or bypass live setup validation.

After the user submits the final interactive answer, setup SHALL show localized in-progress feedback while reconciliation runs and SHALL end that feedback with a localized success or failure state before rendering detailed results or the failure diagnostic.

#### Scenario: User selects multiple integrations interactively

- **GIVEN** setup has an interactive terminal and no integration flags were supplied
- **WHEN** the user toggles agent-browser, Browser Use, and Playwright CLI in the multiselect and submits it
- **THEN** setup installs or updates all three selected Panerelay integrations
- **AND** it asks only one additional yes-or-no question about defaults
- **AND** the reconciled protected configuration produces the same initial values on the next unflagged interactive run

#### Scenario: Current integration state is restored

- **GIVEN** agent-browser and Playwright Panerelay integrations are currently configured while Browser Use is not and agent-browser is not the Panerelay user default
- **WHEN** the user starts another unflagged interactive setup
- **THEN** agent-browser and Playwright CLI are initially checked while Browser Use is initially unchecked
- **AND** the shared default confirmation is initially `No`

#### Scenario: User unchecks an installed integration

- **GIVEN** a valid Panerelay Browser Use or Playwright adapter is installed and initially selected
- **WHEN** the user unchecks that integration and submits interactive setup
- **THEN** setup removes that integration's Panerelay-owned registration, launcher, configuration, runtime state, and Panerelay preference as applicable
- **AND** it does not uninstall or modify the upstream Browser Use, Browser Harness, or Playwright CLI installation

#### Scenario: User selects no optional integrations

- **GIVEN** one or more Panerelay automation integrations were previously installed
- **WHEN** the user submits the multiselect without selecting an integration
- **THEN** setup keeps the local Native Host and removes every optional Panerelay-owned automation integration
- **AND** it does not ask a default question or print an additional sentence explaining interactive integration flags
- **AND** the absence of configured optional integrations produces an empty initial selection the next time interactive setup opens

#### Scenario: User declines the selected defaults

- **GIVEN** selected agent-browser or Browser Use integrations currently use Panerelay as a user-level default
- **WHEN** the user answers `No` to the shared default confirmation and setup reconciles the selection
- **THEN** setup conditionally clears the Panerelay agent-browser default and selects Browser Use Direct mode for the selected integrations
- **AND** it preserves an unrelated agent-browser default and does not remove either selected integration

#### Scenario: Existing installation initializes the prompt

- **GIVEN** one or more structurally valid Panerelay Provider or adapter registrations already exist
- **WHEN** the user starts an unflagged interactive setup
- **THEN** setup initially checks those registered integrations
- **AND** it initializes the shared default to `Yes` only when every initially selected default-capable integration already uses Panerelay as its default

#### Scenario: Current configuration is invalid or unprotected

- **GIVEN** a Provider, adapter registry, or default preference has an invalid schema, unsafe file type, or overly broad permissions
- **WHEN** setup resolves initial prompt values
- **THEN** it ignores the affected state and uses only other valid protected configuration or safe unselected values
- **AND** it does not delete integrations, change defaults, or perform setup work before the user submits the prompt

#### Scenario: User selects only Playwright interactively

- **GIVEN** setup has an interactive terminal and no integration flags were supplied
- **WHEN** the user selects only Playwright CLI
- **THEN** setup installs or updates the Playwright integration and removes other unchecked Panerelay-owned automation integrations
- **AND** Playwright remains an explicit CDP connection without asking a default question

#### Scenario: User cancels an interactive prompt

- **GIVEN** setup has an interactive terminal and no integration flags were supplied
- **WHEN** the user cancels the multiselect or the shared default confirmation
- **THEN** setup reports a localized cancellation
- **AND** it does not change installation or default state

#### Scenario: Submitted setup takes time

- **GIVEN** the user has submitted the final interactive setup answer
- **WHEN** desired-state reconciliation is still running
- **THEN** setup displays a localized timer progress indicator
- **AND** it replaces the pending state with localized completion or failure feedback when reconciliation settles

#### Scenario: Explicit flags are supplied

- **GIVEN** setup receives one or more integration flags or a non-interactive option
- **WHEN** setup runs
- **THEN** it uses the supplied selection without presenting the multiselect
- **AND** it changes user defaults only when `--global-default` was supplied
- **AND** it neither removes unmentioned integrations nor writes a separate interactive selection state
