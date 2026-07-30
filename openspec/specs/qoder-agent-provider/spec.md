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

Panerelay SHALL provide Qoder browser tools through the Panerelay agent-browser Provider and the same browser-side authorization and exclusive control lease required by other Agents.

#### Scenario: Qoder starts without browser authorization

- **GIVEN** Qoder is ready but no browser tab is authorized
- **WHEN** the conversation attempts browser work
- **THEN** the browser tool cannot acquire a target and Qoder receives an actionable failure

#### Scenario: User revokes Qoder browser control

- **GIVEN** a Qoder conversation owns a controlled authorized target
- **WHEN** the user releases authorization or the relay session ends
- **THEN** Panerelay revokes the lease, detaches the target, and rejects further commands using the stale session

### Requirement: Qoder-owned browser sessions clean up at terminal boundaries

Panerelay SHALL retain the unique agent-browser session label assigned to each Qoder conversation and SHALL make a bounded, idempotent close attempt after every completed, failed, or interrupted turn, on Qoder runtime exit, and when the provider closes. A turn SHALL NOT report its terminal event before its close attempt finishes.

#### Scenario: Qoder completes browser work normally

- **GIVEN** a Qoder turn acquired the Panerelay browser control lease through its scoped agent-browser MCP session
- **WHEN** the ACP prompt completes or fails
- **THEN** Panerelay closes that agent-browser session before reporting the terminal turn event so another authorized Agent can acquire browser control

#### Scenario: Qoder is interrupted or shuts down

- **GIVEN** one or more Qoder conversations have assigned agent-browser session labels
- **WHEN** a turn is interrupted, the Qoder runtime exits, or the provider closes
- **THEN** Panerelay attempts cleanup for every affected label without widening browser authorization or closing an unrelated agent-browser session

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
