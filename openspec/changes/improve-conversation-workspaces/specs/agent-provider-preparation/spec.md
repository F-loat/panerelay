## Purpose

Define how PaneRelay warms a selected local Agent provider without creating a conversation or
changing the user's browser-control ownership.

## ADDED Requirements

### Requirement: Provider discovery is side-effect free
PaneRelay SHALL report whether each configured provider is ready without starting that provider's
long-lived runtime or creating an Agent conversation.

#### Scenario: Listing ready providers
- **WHEN** the Side Panel requests the provider list
- **THEN** PaneRelay returns readiness and version metadata without starting a provider runtime or conversation

### Requirement: Providers can be prepared independently
PaneRelay SHALL expose an idempotent provider-preparation operation that starts or warms the
selected ready provider while leaving conversation state unchanged.

#### Scenario: Preparing a ready provider
- **WHEN** the Side Panel selects a ready provider that has not been prepared
- **THEN** PaneRelay starts or warms that provider without creating or resuming a conversation

#### Scenario: Repeating preparation
- **WHEN** preparation is requested more than once for an already prepared provider
- **THEN** PaneRelay reuses the prepared runtime and does not create duplicate provider processes or conversations

### Requirement: Preparation failures stay contextual
PaneRelay SHALL report provider-preparation failures to the requesting Side Panel without changing
tab authorization, browser-control ownership, or the global Extension connection status.

#### Scenario: Preparation fails
- **WHEN** a selected provider cannot start or warm successfully
- **THEN** the Side Panel shows a provider-specific retryable failure while the Extension and unrelated providers remain usable

#### Scenario: Unavailable provider is selected
- **WHEN** the user selects a provider whose readiness is unavailable
- **THEN** PaneRelay shows its installation guidance and does not attempt preparation
