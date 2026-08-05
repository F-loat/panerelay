## ADDED Requirements

### Requirement: Qoder live messages survive Side Panel remounts within one provider process

Panerelay SHALL retain at most the bounded provider-neutral user and completed assistant text messages observed for each live Qoder ACP conversation. When Qoder successfully loads a conversation without emitting history message chunks, Panerelay SHALL return the retained messages for that conversation. The retained transcript MUST remain in memory, MUST be cleared when the Qoder provider process closes, and MUST NOT include reasoning, activity output, approvals, images, raw ACP objects, or Panerelay's first-turn context envelope.

#### Scenario: Qoder load emits no history chunks

- **GIVEN** Qoder completed a text turn in a conversation known to the current Bridge provider process
- **AND** Qoder 1.1.2 accepts `session/load` without emitting user or agent history chunks
- **WHEN** Panerelay resumes that conversation
- **THEN** Panerelay returns the retained normalized user and completed assistant messages in order

#### Scenario: Qoder load emits provider history

- **GIVEN** Panerelay retained live messages for a Qoder conversation
- **WHEN** Qoder loads that conversation and emits non-empty history message chunks
- **THEN** Panerelay returns the normalized Qoder history as authoritative
- **AND** it refreshes the process-local retained transcript without duplicating messages

#### Scenario: First-turn context remains hidden in fallback history

- **GIVEN** Panerelay supplied bounded first-turn context separately from the user's visible text
- **WHEN** Qoder history replay is empty and Panerelay returns retained messages
- **THEN** the returned user message contains the bounded user text
- **AND** it does not contain the Panerelay context envelope
