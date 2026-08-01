## MODIFIED Requirements

### Requirement: Panerelay supports reversible default and one-run connection selection

The integration SHALL store a Direct or Panerelay Extension connection preference in Panerelay-owned configuration. The setup-managed Extension SHALL be able to read that preference and explicitly change it between Direct and Panerelay Extension through the authenticated Native Host only when the Browser Use adapter is registered. An explicit one-run selection SHALL override the saved preference only for the invoked Browser Use operation and SHALL NOT mutate the saved preference, Browser Use configuration, or an already running daemon in the other lane. Changing the saved preference SHALL NOT start a daemon, allocate a participant, authorize a tab, or acquire a control lease.

#### Scenario: Saved mode is Panerelay Extension

- **GIVEN** the Panerelay Browser Use preference selects the Extension connection
- **WHEN** the installed Skill starts Browser Use without an explicit override
- **THEN** the Panerelay CLI resolves the registered Browser Use adapter
- **AND** Browser Use receives only the Panerelay-owned runtime name, runtime directory, and current CDP bootstrap URL

#### Scenario: Saved mode is Direct

- **GIVEN** the saved preference selects Direct
- **WHEN** the installed Skill starts Browser Use without an explicit override
- **THEN** Browser Use uses its normal direct connection behavior
- **AND** the CLI bypasses Panerelay browser selection and reads no Bridge connection credentials
- **AND** no Panerelay CDP ticket, participant, or Extension authorization is created

#### Scenario: Extension selects Panerelay as the Browser Use default

- **GIVEN** the protected Browser Use adapter registration exists
- **AND** the saved preference is Direct or absent
- **WHEN** the user explicitly enables Browser Use in the Extension's default settings row
- **THEN** the Bridge stores Extension mode through the same Panerelay-owned preference used by the CLI
- **AND** the operation returns only bounded availability, mode, and selection state to the Extension

#### Scenario: Extension clears the Browser Use Panerelay default

- **GIVEN** the saved Browser Use preference is Extension mode
- **WHEN** the user explicitly disables Browser Use in the Extension's default settings row
- **THEN** the Bridge stores Direct mode without removing the adapter or changing Browser Use configuration
- **AND** a later unoverridden Skill invocation uses Direct behavior

#### Scenario: One run overrides the saved mode

- **GIVEN** either connection mode is saved as the default
- **WHEN** the caller explicitly selects the other mode for one invocation
- **THEN** only that invocation uses the selected lane
- **AND** the saved preference and any healthy daemon in the other lane remain unchanged

#### Scenario: Extension attempts to change an unavailable integration

- **GIVEN** no valid Browser Use adapter registration exists
- **WHEN** the Extension requests a Browser Use default mutation
- **THEN** the Bridge returns an explicit unavailable error
- **AND** it does not create preference, participant, target, authorization, or lease state
