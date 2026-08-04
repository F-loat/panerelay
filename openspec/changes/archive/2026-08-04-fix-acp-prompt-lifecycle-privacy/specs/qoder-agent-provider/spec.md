## ADDED Requirements

### Requirement: Qoder ACP prompts preserve user input and long-turn lifecycle

Panerelay SHALL preserve the established ordering and meaning of its bounded first-turn guidance, the user's text, and supported images, while delimiting Panerelay-authored text so it can be excluded from user-visible history. Panerelay SHALL keep an accepted ACP prompt active until Qoder returns a terminal response, the user interrupts it, the runtime exits, or the provider closes. The ordinary control-request timeout MUST NOT independently fail an active prompt turn.

#### Scenario: Qoder accepts a first-turn prompt

- **GIVEN** Qoder accepted a new ACP session
- **WHEN** the user sends the first text or image prompt in a new conversation
- **THEN** Panerelay sends the same bounded guidance and page orientation before the complete user text while preserving supported image blocks
- **AND** Qoder receives the same browser guidance and bounded page metadata required for a new conversation

#### Scenario: Qoder turn exceeds the control-request timeout

- **GIVEN** Qoder accepted a prompt and continues streaming a valid turn beyond the ordinary ACP control-request timeout
- **WHEN** no user interruption, runtime exit, or provider shutdown occurs
- **THEN** Panerelay keeps the turn active and forwards its normalized updates
- **AND** it does not report a prompt timeout or detach the running Qoder turn

#### Scenario: User interrupts a long Qoder turn

- **GIVEN** a Qoder prompt remains active
- **WHEN** the user interrupts the turn
- **THEN** Panerelay sends the correlated ACP session cancellation and resolves pending permissions
- **AND** the turn produces exactly one interrupted terminal event after Qoder settles the prompt

#### Scenario: Qoder exits during a prompt

- **GIVEN** a Qoder prompt remains active
- **WHEN** the Qoder runtime exits or the provider closes before returning a terminal response
- **THEN** Panerelay resolves pending permissions and settles the turn exactly once as failed or interrupted as appropriate
- **AND** late updates cannot revive or complete the settled turn a second time
