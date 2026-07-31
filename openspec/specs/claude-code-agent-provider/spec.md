# claude-code-agent-provider Specification

## Purpose

Define how Panerelay exposes a local Claude Code runtime as a provider-neutral side-panel Agent with bounded history, streaming, tools, approvals, interruption, and resume support.

## Requirements

### Requirement: Claude Code is discovered without blocking other providers

Panerelay SHALL advertise a `claude` Agent Provider, SHALL report it ready only when a usable local Claude Code executable is configured or discovered, and SHALL keep Codex, Qoder, and browser automation usable when Claude Code is unavailable.

#### Scenario: Claude Code is available

- **GIVEN** setup discovers a usable Claude Code executable
- **WHEN** the Extension requests Agent providers
- **THEN** Panerelay reports Claude Code as ready with its supported capabilities and version when available

#### Scenario: Claude Code is absent

- **GIVEN** no usable Claude Code executable is configured or discovered
- **WHEN** setup, doctor, or the Extension inspects providers
- **THEN** Claude Code is reported as optional and unavailable with install and login guidance
- **AND** no other provider or browser capability becomes unhealthy

### Requirement: Claude Code history is bounded and project aware

Panerelay SHALL list recent Claude Code sessions through the supported session-history interface, SHALL allow an optional canonical project directory to scope the list, and SHALL normalize stored user and assistant text into provider-neutral conversation detail without exposing raw transcript records.

#### Scenario: Project-scoped history is requested

- **GIVEN** the side panel has a canonical selected project directory
- **WHEN** it requests Claude Code conversation history
- **THEN** Panerelay returns a bounded newest-first list for that directory and its supported worktrees

#### Scenario: A stored conversation is resumed

- **GIVEN** a listed Claude Code session has readable stored messages
- **WHEN** the user selects it
- **THEN** Panerelay returns normalized user and assistant history and prepares the session ID for the next turn

### Requirement: Claude Code turns use provider-neutral streaming events

Panerelay SHALL execute each Claude Code turn in the conversation's canonical working directory and SHALL normalize turn start, assistant text, reasoning when supplied, tool activity, usage, completion, and failure into the shared conversation event union.

#### Scenario: A turn streams assistant output and tools

- **GIVEN** a Claude Code conversation is idle
- **WHEN** the user sends a text or supported image message
- **THEN** the side panel receives one turn start, incremental assistant output, normalized tool activity, usage when supplied, and one terminal turn event

#### Scenario: Claude Code reports an execution error

- **GIVEN** a Claude Code turn fails authentication, process startup, or execution
- **WHEN** Panerelay receives the terminal failure
- **THEN** it emits a failed terminal turn with actionable bounded detail and keeps the provider retryable

### Requirement: Claude Code approvals remain user controlled

Panerelay SHALL route Claude Code tool permission requests through the existing normalized approval flow, SHALL keep each request correlated to one conversation and turn, and SHALL fail closed when a request is cancelled, stale, unsupported, or unanswered.

#### Scenario: User approves one Claude Code tool call

- **GIVEN** Claude Code requests permission for a tool in the displayed conversation
- **WHEN** the user selects the one-request accept decision
- **THEN** Panerelay permits only that pending tool call and reports the approval resolved

#### Scenario: User declines or cancels an approval

- **GIVEN** Claude Code is waiting on a tool permission
- **WHEN** the user declines, cancels, interrupts, closes, or switches away from the live turn
- **THEN** Panerelay denies or aborts the pending operation and does not widen future permissions

### Requirement: Claude Code turns can be interrupted and resumed

Panerelay SHALL support interrupting the active Claude Code query, SHALL reject mismatched conversation or turn identifiers, and SHALL resume a stored session without creating an unrelated conversation identity.

#### Scenario: Active turn is interrupted

- **GIVEN** Claude Code is running the identified turn
- **WHEN** the user requests interruption
- **THEN** Panerelay interrupts the active query, resolves pending approvals fail closed, and emits an interrupted terminal event

#### Scenario: User sends another message after resume

- **GIVEN** Panerelay loaded a stored Claude Code session
- **WHEN** the user sends the next message
- **THEN** Claude Code continues that session in its recorded working directory and the side panel retains the same conversation ID
