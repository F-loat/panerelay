## Purpose

Define how PaneRelay warms a selected local Agent provider without creating a conversation or changing the user's browser-control ownership.

## ADDED Requirements

### Requirement: Provider discovery is side-effect free

PaneRelay SHALL report whether each configured provider is ready without starting that provider's long-lived runtime or creating an Agent conversation.

#### Scenario: Listing ready providers

- **WHEN** the Side Panel requests the provider list
- **THEN** PaneRelay returns readiness and version metadata without starting a provider runtime or conversation

### Requirement: Providers can be prepared independently

PaneRelay SHALL expose an idempotent provider-preparation operation that starts or warms the selected ready provider while leaving conversation state unchanged.

#### Scenario: Preparing a ready provider

- **WHEN** the Side Panel selects a ready provider that has not been prepared
- **THEN** PaneRelay starts or warms that provider without creating or resuming a conversation

#### Scenario: Repeating preparation

- **WHEN** preparation is requested more than once for an already prepared provider
- **THEN** PaneRelay reuses the prepared runtime and does not create duplicate provider processes or conversations

### Requirement: Preparation failures stay contextual

PaneRelay SHALL report provider-preparation failures to the requesting Side Panel without changing tab authorization, browser-control ownership, or the global Extension connection status.

#### Scenario: Preparation fails

- **WHEN** a selected provider cannot start or warm successfully
- **THEN** the Side Panel shows a provider-specific retryable failure while the Extension and unrelated providers remain usable

#### Scenario: Unavailable provider is selected

- **WHEN** the user selects a provider whose readiness is unavailable
- **THEN** PaneRelay shows its installation guidance and does not attempt preparation

### Requirement: Effective model metadata is visible when known

PaneRelay SHALL expose the effective model reported by a provider for a prepared default or active conversation without exposing model credentials or presenting inferred data as authoritative. The Side Panel SHALL display that model only for a selected installed provider when the value is available and SHALL omit model copy when the value is not available.

#### Scenario: Prepared provider reports its default model

- **WHEN** a ready provider is prepared and reports the model that a new conversation would use
- **THEN** the Side Panel displays that model before the first conversation is created

#### Scenario: Conversation reports an effective model

- **WHEN** PaneRelay starts or resumes a conversation whose provider reports an effective model
- **THEN** the Side Panel displays the conversation model even when it differs from the provider default

#### Scenario: Provider does not report a model

- **WHEN** the selected provider or conversation does not expose an effective model
- **THEN** the Side Panel shows its normal connection state without a model label or placeholder

#### Scenario: Selected provider is not installed

- **WHEN** the selected provider is unavailable even if stale conversation metadata exists locally
- **THEN** the Side Panel does not display model copy for that provider
