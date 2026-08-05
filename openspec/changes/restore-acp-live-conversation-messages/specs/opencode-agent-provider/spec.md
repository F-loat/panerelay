## ADDED Requirements

### Requirement: OpenCode live messages survive Side Panel remounts within one provider process

Panerelay SHALL apply the shared bounded process-local ACP transcript behavior to OpenCode conversations. Non-empty normalized OpenCode load history SHALL remain authoritative; when a supported OpenCode runtime loads a conversation known to the current provider process without emitting message history, Panerelay SHALL return its retained normalized user and completed assistant messages. The fallback MUST NOT persist conversation content or include reasoning, activities, approvals, images, or raw provider objects.

#### Scenario: OpenCode emits load history

- **GIVEN** Panerelay retained live messages for an OpenCode conversation
- **WHEN** OpenCode 1.18.12 loads that conversation and emits non-empty history chunks
- **THEN** Panerelay returns the normalized provider history without duplicate fallback messages

#### Scenario: OpenCode load history is empty

- **GIVEN** OpenCode completed a text turn in a conversation known to the current Bridge provider process
- **WHEN** a supported OpenCode runtime loads that conversation without emitting message history
- **THEN** Panerelay returns the retained normalized user and completed assistant messages in order

#### Scenario: OpenCode provider closes

- **GIVEN** Panerelay retained live OpenCode messages only in the provider process
- **WHEN** that provider process closes and a later load also emits no history
- **THEN** Panerelay does not fabricate the prior process's messages
