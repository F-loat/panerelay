## ADDED Requirements

### Requirement: Bound live ACP conversations restore retained messages after a Side Panel remount

Panerelay SHALL restore the bounded normalized user and assistant messages retained for a bound ACP conversation when the Side Panel is closed and reopened while the same Bridge provider process remains active and the provider returns no replayed history. Non-empty normalized provider history SHALL remain authoritative and MUST NOT be duplicated with retained messages. The fallback MUST remain process-local and MUST NOT change browser authorization, target selection, revocation, or control ownership.

#### Scenario: Side Panel reopens after a completed live turn

- **GIVEN** a bound ACP conversation completed a user and assistant exchange in the current Bridge provider process
- **AND** loading that conversation emits no provider history messages
- **WHEN** the user closes and reopens the Side Panel on the bound tab
- **THEN** the Side Panel displays the retained bounded user and assistant messages in their original order

#### Scenario: Provider replays normalized history

- **GIVEN** a bound ACP conversation has process-local retained messages
- **WHEN** loading that conversation returns non-empty normalized provider history
- **THEN** the Side Panel displays the provider history without appending duplicate retained messages

#### Scenario: Provider process was restarted

- **GIVEN** a bound ACP conversation has no messages available from the current provider process or provider history
- **WHEN** the Side Panel resumes that conversation after the prior provider process ended
- **THEN** Panerelay returns no fabricated message history

#### Scenario: Conversation messages are restored without browser authority

- **GIVEN** a bound conversation has retained messages but its browser authorization or control lease was revoked
- **WHEN** the Side Panel restores those messages
- **THEN** the messages remain visible for chat history
- **AND** Panerelay does not restore or grant browser authorization or control
