## ADDED Requirements

### Requirement: OpenCode ACP prompts preserve user input and long-turn lifecycle

Panerelay SHALL preserve the established ordering and meaning of its bounded first-turn guidance, the user's text, and supported images, while delimiting Panerelay-authored text so it can be excluded from user-visible history. Panerelay SHALL keep an accepted ACP prompt active until OpenCode returns a terminal response, the user interrupts it, the runtime exits, or the provider closes. The ordinary control-request timeout MUST NOT independently fail an active prompt turn.

#### Scenario: OpenCode accepts a first-turn prompt

- **GIVEN** OpenCode accepted a new ACP session
- **WHEN** the user sends the first text or image prompt in a new conversation
- **THEN** Panerelay sends the same bounded guidance and page orientation before the complete user text while preserving supported image blocks
- **AND** OpenCode receives the same browser guidance and bounded page metadata required for a new conversation

#### Scenario: OpenCode turn exceeds the control-request timeout

- **GIVEN** OpenCode accepted a prompt and continues streaming a valid turn beyond the ordinary ACP control-request timeout
- **WHEN** no user interruption, runtime exit, or provider shutdown occurs
- **THEN** Panerelay keeps the turn active and forwards its normalized updates
- **AND** it does not report a prompt timeout or detach the running OpenCode turn

#### Scenario: User interrupts a long OpenCode turn

- **GIVEN** an OpenCode prompt remains active
- **WHEN** the user interrupts the turn
- **THEN** Panerelay sends the correlated ACP session cancellation and resolves pending permissions
- **AND** the turn produces exactly one interrupted terminal event after OpenCode settles the prompt

#### Scenario: OpenCode exits during a prompt

- **GIVEN** an OpenCode prompt remains active
- **WHEN** the OpenCode runtime exits or the provider closes before returning a terminal response
- **THEN** Panerelay resolves pending permissions and settles the turn exactly once as failed or interrupted as appropriate
- **AND** late updates cannot revive or complete the settled turn a second time
