## MODIFIED Requirements

### Requirement: Providers can be prepared independently

PaneRelay SHALL expose an idempotent provider-preparation operation that starts or warms the selected ready provider while leaving conversation state unchanged. A provider process launched by the Native Host SHALL receive a bounded environment whose command-search path prepends validated absolute directories captured by setup and retains the current host path afterward.

#### Scenario: Preparing a ready provider

- **WHEN** the Side Panel selects a ready provider that has not been prepared
- **THEN** PaneRelay starts or warms that provider without creating or resuming a conversation

#### Scenario: Native Host has a minimal path

- **GIVEN** setup captured a bounded normal command-search path in protected runtime configuration
- **AND** the browser starts the Native Host with a smaller system path
- **WHEN** Panerelay prepares a local Agent provider
- **THEN** the provider receives the captured entries followed by current host entries with platform-correct delimiter and key casing
- **AND** relative, malformed, duplicate, and oversized captured entries are excluded

#### Scenario: Repeating preparation

- **WHEN** preparation is requested more than once for an already prepared provider
- **THEN** PaneRelay reuses the prepared runtime and does not create duplicate provider processes or conversations
