## ADDED Requirements

### Requirement: Adapter manifests declare network and browser-state authority

Every source and compiled fetch-adapter manifest SHALL declare a bounded normalized origin list and MAY declare protected browser-state binding policies. Setup, registry reads, source inspection, artifact verification, and runtime dispatch SHALL reject missing, malformed, widened, or hash-mismatched authority metadata. Adapter code SHALL receive only binding IDs, not resolved values or mutable policy definitions.

#### Scenario: Source adapter is built

- **GIVEN** a source-form adapter declares valid origins and optional binding policies as literal metadata
- **WHEN** setup builds and inspects it
- **THEN** the compiled manifest preserves exactly that authority metadata
- **AND** the protected registry copy is used to create adapter fetch sessions

#### Scenario: Legacy manifest has no origins

- **GIVEN** a manifest uses the previous protocol without an origin list
- **WHEN** setup or the CLI validates it
- **THEN** validation fails with migration guidance
- **AND** Panerelay does not infer authority from executable code or a first request

### Requirement: Flomo memos use exact-origin localStorage binding

The built-in Flomo adapter SHALL expose its fetch-expressible memo-list operation by binding the signed-in web application's declared `localStorage.me` access token to the fixed Flomo API Authorization header inside the Extension. It SHALL require an already-open signed-in Flomo tab and SHALL keep login, navigation, and storage export unsupported.

#### Scenario: Signed-in Flomo tab is open

- **GIVEN** the user granted the declared Flomo origins and an open Flomo tab contains the expected access token
- **WHEN** the user invokes the Flomo memo command
- **THEN** the adapter returns bounded memo rows from the Flomo API
- **AND** no access token appears in adapter input, output, diagnostics, or default logs

#### Scenario: Flomo storage is unavailable

- **GIVEN** no exact-origin Flomo tab or usable declared token exists
- **WHEN** the user invokes the Flomo memo command
- **THEN** the adapter fails with signed-in-tab guidance before API traffic
- **AND** it does not navigate to login or ask for a manually supplied token
