## MODIFIED Requirements

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
