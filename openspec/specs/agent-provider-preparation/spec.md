## Purpose

Define how PaneRelay warms a selected local Agent provider without creating a conversation or changing the user's browser-control ownership.

## Requirements

### Requirement: Provider discovery is side-effect free

PaneRelay SHALL report whether each configured provider is ready without starting that provider's long-lived runtime or creating an Agent conversation. The Side Panel MAY cache the last supported provider presentation and selected provider for its first render, but live discovery SHALL remain authoritative before Agent actions become available.

#### Scenario: Listing ready providers

- **WHEN** the Side Panel requests the provider list
- **THEN** PaneRelay returns readiness and version metadata without starting a provider runtime or conversation

#### Scenario: Side Panel reopens with a valid cache

- **GIVEN** a prior successful discovery cached Qoder as ready and the user selected Qoder
- **WHEN** the Side Panel opens again
- **THEN** its first rendered provider header shows Qoder with cached bounded labels and neutral connecting status instead of a fabricated Codex-unavailable or premature connected state
- **AND** Agent actions remain disabled until live Extension status, provider discovery, and workspace restoration complete

#### Scenario: Cached readiness is followed by provider preparation

- **GIVEN** the cache reported the selected provider ready
- **WHEN** live Extension status arrives before provider discovery and runtime preparation complete
- **THEN** the header remains neutral connecting throughout initialization
- **AND** it changes to connected only after initialization and required provider preparation complete

#### Scenario: Live readiness differs from cache

- **GIVEN** the cached selected provider was previously ready
- **WHEN** live discovery reports it unavailable
- **THEN** the Side Panel replaces the cache and applies the existing live ready-provider fallback
- **AND** it does not use cached readiness to prepare, resume, or send to the unavailable provider

#### Scenario: Provider cache is invalid

- **GIVEN** the stored cache has an unknown version, unknown provider ID, invalid status, or oversized display label
- **WHEN** the Side Panel bootstraps
- **THEN** it ignores the invalid entries and shows a neutral connecting presentation until live discovery completes
- **AND** no invalid cache value crosses to the Bridge

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
