## MODIFIED Requirements

### Requirement: Claude Code is discovered without blocking other providers

Panerelay SHALL advertise a `claude` Agent Provider, SHALL report it ready only when a usable user-owned Claude Code CLI at or above the supported minimum is configured or discovered, SHALL NOT install or update Claude Code without an explicit user action, and SHALL keep Codex, Qoder, and browser automation usable when Claude Code is unavailable or incompatible.

#### Scenario: A supported Claude Code CLI is available

- **GIVEN** setup discovers a usable Claude Code CLI at or above the supported minimum
- **WHEN** the Extension requests Agent providers
- **THEN** Panerelay reports Claude Code as ready with its supported capabilities and detected version
- **AND** turns execute through that discovered CLI

#### Scenario: Claude Code is absent

- **GIVEN** no usable Claude Code executable is configured or discovered
- **WHEN** setup, doctor, or the Extension inspects providers
- **THEN** Claude Code is reported as optional and unavailable with install and login guidance
- **AND** no other provider or browser capability becomes unhealthy

#### Scenario: Claude Code is older than the supported minimum

- **GIVEN** setup discovers an executable Claude Code CLI below the supported minimum
- **WHEN** doctor or the Extension inspects providers
- **THEN** Panerelay reports Claude Code as incompatible with an actionable upgrade instruction
- **AND** it does not start a turn with an unverified stream protocol

### Requirement: Claude Code turns use provider-neutral streaming events

Panerelay SHALL execute each Claude Code turn in the conversation's canonical working directory through the discovered non-interactive CLI, SHALL use bounded newline-delimited JSON input and output, and SHALL normalize turn start, assistant text, reasoning when supplied, tool activity, usage, completion, and failure into the shared conversation event union.

#### Scenario: A turn streams assistant output and tools

- **GIVEN** a Claude Code conversation is idle
- **WHEN** the user sends a text or supported image message
- **THEN** Panerelay starts the discovered CLI in the canonical working directory
- **AND** the side panel receives one turn start, incremental assistant output, normalized tool activity, usage when supplied, and one terminal turn event

#### Scenario: Claude Code reports an execution error

- **GIVEN** a Claude Code turn fails authentication, process startup, protocol parsing, or execution
- **WHEN** Panerelay receives the process or terminal failure
- **THEN** it emits a failed terminal turn with actionable bounded detail
- **AND** it terminates the scoped process and keeps the provider retryable

#### Scenario: Claude Code emits malformed or oversized stream data

- **GIVEN** the discovered CLI emits a malformed or over-limit stream record
- **WHEN** Panerelay parses the record
- **THEN** it fails the turn closed without logging the record body
- **AND** no raw provider payload crosses the Bridge protocol boundary

### Requirement: Claude Code approvals remain user controlled

Panerelay SHALL route Claude Code tool permission requests through a turn-scoped MCP permission tool and the existing normalized approval flow, SHALL keep each request correlated to one conversation and turn, SHALL ensure lower-priority user or project allow rules cannot bypass approval for mutating built-in or Panerelay browser tools, and SHALL fail closed when a request is cancelled, stale, unsupported, disconnected, or unanswered.

#### Scenario: User approves one Claude Code tool call

- **GIVEN** Claude Code invokes the configured Panerelay MCP permission tool for a pending tool call
- **WHEN** the user selects the one-request accept decision
- **THEN** Panerelay returns one allow result containing the original tool input
- **AND** it reports the approval resolved without widening future permissions

#### Scenario: User declines or abandons an approval

- **GIVEN** Claude Code is waiting on the turn-scoped MCP permission tool
- **WHEN** the user declines, cancels, interrupts, closes, disconnects, or switches away from the live turn
- **THEN** Panerelay returns or records a deny result and resolves the displayed approval
- **AND** the scoped permission endpoint is closed during terminal cleanup

#### Scenario: Lower-priority settings allow a mutating tool

- **GIVEN** user or project Claude settings contain an allow rule for a mutating built-in or Panerelay browser tool
- **WHEN** Claude Code runs through Panerelay
- **THEN** the scoped command-line ask rule takes precedence and invokes the Panerelay permission tool
