# qoder-agent-provider Specification

## Purpose

Define how Panerelay exposes Qoder CLI as an optional ACP-backed Agent while preserving its provider-neutral conversation, browser-authorization, approval, and cleanup boundaries.

## Requirements

### Requirement: Qoder availability is discovered without blocking other providers

Panerelay SHALL discover configured, PATH-based, and documented user-local Qoder CLI candidates, probe ACP availability, and expose one provider descriptor with actionable setup guidance.

#### Scenario: Compatible Qoder CLI is installed

- **GIVEN** a Qoder CLI candidate can report its version and initialize ACP
- **WHEN** the side panel requests Agent providers
- **THEN** Qoder appears as ready alongside every other available provider

#### Scenario: Qoder is missing or incompatible

- **GIVEN** no Qoder CLI candidate can initialize the required ACP behavior
- **WHEN** the side panel requests Agent providers
- **THEN** Qoder appears as unavailable with install or login guidance while Codex and agent-browser workflows remain usable

### Requirement: Qoder conversations use capability-negotiated ACP sessions

Panerelay SHALL start, list, resume, prompt, interrupt, and close Qoder conversations only when the installed runtime advertises the corresponding ACP capability, and SHALL fail unsupported operations explicitly.

#### Scenario: Start and prompt a Qoder conversation

- **GIVEN** Qoder initialized ACP and the user selected a valid working directory
- **WHEN** the user starts a conversation and sends text
- **THEN** Panerelay creates an ACP session, sends the prompt, and correlates the turn with the Panerelay conversation

#### Scenario: Runtime cannot list or resume sessions

- **GIVEN** the installed Qoder runtime does not advertise the requested session capability
- **WHEN** the user lists or resumes conversations
- **THEN** Panerelay reports that operation as unavailable without fabricating sessions or history

### Requirement: Qoder events are provider neutral at the Extension boundary

Panerelay SHALL normalize Qoder text, reasoning, plan, tool, usage, completion, cancellation, and error updates into the shared conversation event model before sending them to the Extension.

#### Scenario: Qoder streams a turn

- **GIVEN** an active Qoder ACP prompt emits thought, message, plan, and tool updates
- **WHEN** Panerelay forwards the turn to the side panel
- **THEN** the panel receives bounded normalized events associated with the correct conversation and turn

#### Scenario: Qoder emits an unknown provider-native update

- **GIVEN** a Qoder version emits an ACP update Panerelay does not support
- **WHEN** the Bridge receives it
- **THEN** Panerelay does not expose the raw provider object or claim successful normalized behavior

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

### Requirement: Qoder permission requests remain user controlled

Panerelay SHALL translate supported ACP permission options into explicit side-panel approval choices, correlate one response to the pending request, and cancel unanswered requests when the turn, session, provider process, or Bridge ends.

#### Scenario: User approves one Qoder tool call

- **GIVEN** Qoder requests permission with a supported one-time approval option
- **WHEN** the user selects that option in the side panel
- **THEN** Panerelay returns only the correlated ACP option identifier and marks the approval resolved

#### Scenario: Permission request cannot be represented safely

- **GIVEN** Qoder requests a permission shape Panerelay cannot normalize
- **WHEN** the Bridge evaluates the request
- **THEN** it cancels or rejects the request instead of selecting a broader permission

#### Scenario: User interrupts with a permission pending

- **GIVEN** a Qoder permission request is waiting for a response
- **WHEN** the user interrupts or closes the conversation
- **THEN** Panerelay cancels the pending request and the Qoder turn cannot continue under stale approval

### Requirement: Qoder browser access uses the existing scoped relay

Panerelay SHALL NOT inject an agent-browser or Browser Use MCP server, Skill, browser instruction, or per-conversation automation session into Qoder. Qoder SHALL receive its normal Agent configuration and environment, and any user-configured browser tool that connects through Panerelay SHALL remain subject to the same browser-side authorization, routing, and exclusive control lease as other automation participants.

#### Scenario: Qoder starts without a configured browser tool

- **GIVEN** Qoder is ready and its own Agent configuration contains no browser integration
- **WHEN** Panerelay creates or resumes a side-panel conversation
- **THEN** the ACP session receives no Panerelay-injected browser MCP server or Skill
- **AND** ordinary conversation behavior remains available

#### Scenario: Qoder uses its own Panerelay browser configuration

- **GIVEN** the user configured a supported browser tool directly in Qoder
- **WHEN** that tool connects through Panerelay from a side-panel conversation
- **THEN** it uses the current browser routing context and normal authorization and control-lease checks
- **AND** Panerelay does not rewrite or replace Qoder's tool configuration

### Requirement: Qoder-owned browser sessions clean up at terminal boundaries

Panerelay SHALL NOT assign, retain, or close an agent-browser or Browser Use session on behalf of a Qoder conversation. Qoder and its configured browser integration SHALL own their tool-process and session lifecycle, while Panerelay SHALL continue to revoke any resulting participant through the normal user release, transport-loss, heartbeat, and Extension/Native Host shutdown boundaries.

#### Scenario: Qoder turn reaches a terminal state

- **GIVEN** Qoder used a browser tool from its own configuration
- **WHEN** the ACP prompt completes, fails, or is interrupted
- **THEN** Panerelay reports the terminal turn without issuing an engine-specific close command
- **AND** normal relay liveness and user revocation remain available

#### Scenario: Qoder runtime exits

- **GIVEN** a configured browser participant outlives a Qoder runtime process
- **WHEN** Qoder exits or the provider closes
- **THEN** Panerelay does not kill or close the engine session by inferred ownership
- **AND** transport loss, heartbeat expiry, user release, or Native Host shutdown removes its browser authority

### Requirement: Provider selection keeps supported Agents visible and isolated

Panerelay SHALL keep every Agent provider supported by the current build visible regardless of installation state, SHALL prefer a ready provider for a new default selection, and SHALL select Codex when none is ready. Panerelay SHALL keep conversations associated with their originating provider and route every operation only to a ready matching provider.

#### Scenario: Codex and Qoder are both ready

- **GIVEN** both provider descriptors are available
- **WHEN** the user switches the side-panel selection
- **THEN** new and resumed conversation operations use the selected provider without changing browser authorization

#### Scenario: One supported provider is installed

- **GIVEN** one supported provider is ready and another is unavailable
- **WHEN** the side panel resolves the default selection without a ready prior choice
- **THEN** it selects the ready provider while keeping both providers visible

#### Scenario: No supported provider is installed

- **GIVEN** Codex and Qoder are both unavailable
- **WHEN** the side panel resolves the default selection
- **THEN** it selects Codex instead of showing an empty or "no provider available" option

#### Scenario: User selects an unavailable provider

- **GIVEN** a supported provider is visible but its CLI is unavailable
- **WHEN** the user selects that provider
- **THEN** the conversation area shows structured install, login, and official-documentation guidance, and conversation actions remain disabled until the provider becomes ready

#### Scenario: Provider discovery is incomplete

- **GIVEN** the Bridge is disconnected or returns fewer descriptors than the build supports
- **WHEN** the side panel renders its selector
- **THEN** it retains every supported catalog entry and overlays only the runtime state it received

#### Scenario: Conversation provider does not match request

- **GIVEN** a conversation belongs to Qoder
- **WHEN** a request presents that conversation ID to another provider
- **THEN** Panerelay fails the request without leaking or mutating the Qoder session
