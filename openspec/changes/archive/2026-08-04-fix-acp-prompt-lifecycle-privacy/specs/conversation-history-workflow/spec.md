## ADDED Requirements

### Requirement: Internal conversation context stays out of user-visible history

Panerelay SHALL preserve provider-neutral guidance and bounded page orientation for the Agent while excluding Panerelay-authored context from messages presented as user-authored conversation history. New ACP context MUST use the exact `<panerelay-context version="1">` / `</panerelay-context>` boundary. History normalization MUST preserve the user's complete bounded text, MUST match the v1 boundary literally rather than accepting loose XML-like variants, MUST NOT use broad keyword redaction, and MUST NOT expose internal context merely because a provider persists it in a user-message-shaped transcript entry.

#### Scenario: Versioned context is loaded from ACP history

- **GIVEN** an ACP conversation was created with a literal `<panerelay-context version="1">` context envelope before its user content
- **WHEN** the user resumes that conversation
- **THEN** the Side Panel shows the complete real user message and normalized assistant messages
- **AND** it does not render the Panerelay context envelope as a user message

#### Scenario: Legacy combined first prompt is loaded

- **GIVEN** a prior Panerelay version persisted its known bounded context prefix together with the first user message
- **WHEN** the user resumes that conversation
- **THEN** Panerelay removes only the recognized leading context envelope and preserves the complete remaining user text

#### Scenario: User writes similar instructional text

- **GIVEN** a user message contains words or sentences that resemble part of Panerelay guidance but is not a recognized leading context envelope
- **WHEN** Panerelay normalizes loaded history
- **THEN** it preserves that user message unchanged

#### Scenario: Legacy image-only first turn is loaded

- **GIVEN** a prior Panerelay version persisted only its known context text alongside an image-only first turn
- **WHEN** the user resumes that conversation
- **THEN** Panerelay omits the context-only text entry instead of presenting it as user-authored text
- **AND** it does not invent replacement user text or alter assistant history
