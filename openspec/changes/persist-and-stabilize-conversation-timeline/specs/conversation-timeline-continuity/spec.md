## Purpose

Keep the Side Panel's normalized visible conversation timeline coherent across panel lifecycles within one Chrome session without weakening privacy or browser-control boundaries.

## ADDED Requirements

### Requirement: Visible timelines survive Side Panel recreation

Panerelay SHALL retain a bounded session-local representation of each active provider conversation's normalized visible timeline and SHALL restore it when the Side Panel document is recreated during the same Chrome session.

#### Scenario: Reopening a completed conversation

- **GIVEN** a bound conversation contains user and assistant messages, reasoning cards, activity cards, and terminal errors
- **WHEN** the user closes and reopens the Side Panel during the same Chrome session
- **THEN** Panerelay restores those retained visible items in their prior order
- **AND** it does not reduce the timeline to provider message history alone

#### Scenario: Output continues while the panel is closed

- **GIVEN** a retained conversation has an Agent turn in progress
- **WHEN** normalized conversation events arrive after the Side Panel document closes and before it reopens
- **THEN** Panerelay retains the bounded events in the Extension background
- **AND** applies them after the latest retained timeline when the panel reopens

#### Scenario: Chrome session ends

- **WHEN** Chrome ends the current browser session and later starts another session
- **THEN** Panerelay does not restore Extension-retained timeline snapshots from the prior session
- **AND** provider-owned history remains independently available through the normal explicit history workflow

#### Scenario: Retention bound is exceeded

- **GIVEN** retained timelines or pending events exceed their documented Extension session bounds
- **WHEN** Panerelay compacts the store
- **THEN** it retains the newest bounded normalized content
- **AND** does not write evicted content to another durable store

#### Scenario: Snapshot acknowledges an event that was not observed

- **GIVEN** a retained timeline journal has assigned sequence numbers only through event N
- **WHEN** a Side Panel snapshot claims to include an event after N
- **THEN** Panerelay rejects that acknowledgement without pruning pending journal events
- **AND** the pending events remain replayable after the invalid save

#### Scenario: Conversation identifier is ambiguous across providers

- **GIVEN** two retained records from different providers use the same opaque conversation identifier
- **WHEN** a normalized event arrives without a provider identifier
- **THEN** Panerelay does not append that event to either record
- **AND** it does not guess a provider from record order or recent activity

### Requirement: Restore does not mix retained and provider timelines

Panerelay SHALL render a valid retained timeline before attempting provider resume and SHALL keep that timeline unchanged by provider-returned messages. Provider resume MAY refresh compatible conversation metadata, and provider-returned messages SHALL be used only when no retained or in-memory timeline exists.

#### Scenario: Provider returns no messages

- **GIVEN** a valid retained timeline exists for the bound conversation
- **WHEN** provider resume succeeds with an empty message list
- **THEN** the retained messages and cards remain visible
- **AND** Panerelay updates only compatible conversation metadata from the provider result

#### Scenario: Provider returns reordered messages with changed identifiers

- **GIVEN** a valid retained timeline exists for the bound conversation
- **WHEN** provider resume returns messages with changed identifiers, timestamps, or ordering
- **THEN** Panerelay does not import those messages into the retained timeline
- **AND** preserves retained messages and semantic cards exactly once in their retained order

#### Scenario: No local timeline exists

- **GIVEN** no valid retained or in-memory timeline exists for a selected conversation
- **WHEN** provider resume returns message history
- **THEN** Panerelay displays that provider history as a fallback
- **AND** does not treat it as proof that semantic cards were reconstructed

#### Scenario: Retained data is invalid

- **GIVEN** a retained record has an unknown schema version, mismatched provider or conversation identifier, or invalid normalized content
- **WHEN** the Side Panel restores the bound conversation
- **THEN** Panerelay ignores that record and falls back to provider resume without rendering unvalidated data

### Requirement: Retained content is privacy bounded and non-authoritative

Panerelay SHALL retain only the bounded normalized text and semantic card fields required to reconstruct the visible conversation. It MUST NOT retain page snapshots, pasted-image data, cookies, credentials, raw ACP or CDP objects, provider-native metadata, hidden Panerelay context, or unbounded tool payloads in the timeline store, and retained state MUST NOT grant or renew any browser or approval authority.

#### Scenario: A visible activity originated from a rich provider payload

- **GIVEN** a normalized activity was derived from raw tool input, output, metadata, images, or terminal handles
- **WHEN** Panerelay retains the visible activity card
- **THEN** it stores only the bounded normalized activity identifier, kind, title, status, displayable output, and diagnostic detail
- **AND** it stores none of the raw provider payload or image data

#### Scenario: A permission request is present when the panel closes

- **GIVEN** the live timeline contains an actionable approval request
- **WHEN** the Side Panel is recreated from retained state
- **THEN** the retained record does not recreate an actionable approval decision
- **AND** only a current live provider event can present an actionable approval request

#### Scenario: Timeline is restored for an unauthorized tab

- **GIVEN** a conversation timeline is restored for a tab without current site authorization or a control lease
- **WHEN** the conversation or Agent attempts browser work
- **THEN** the normal authorization and current control-lease checks still fail closed
- **AND** focus, workspace binding, or restored content grants no additional authority

### Requirement: Reasoning cards have stable live identity

Panerelay SHALL keep each contiguous reasoning segment mounted as one visible timeline card while its deltas arrive and SHALL begin a distinct reasoning segment after another visible event type separates later reasoning output.

#### Scenario: One reasoning segment streams multiple deltas

- **GIVEN** an Agent emits multiple reasoning deltas without an intervening message, activity, or approval event
- **WHEN** the Side Panel renders the turn
- **THEN** it updates one reasoning card with a stable identity
- **AND** the card does not disappear into and reappear from a separate transient status presentation

#### Scenario: A tool separates reasoning segments

- **GIVEN** an Agent emits reasoning, then a tool activity, then more reasoning in one turn
- **WHEN** the Side Panel renders those events
- **THEN** the later reasoning uses a distinct card placed after the activity
- **AND** the earlier reasoning card remains in its original position

#### Scenario: A turn begins before visible output

- **GIVEN** a turn has started but no reasoning, message, activity, or approval output exists yet
- **WHEN** the Side Panel renders the turn
- **THEN** it may show one transient working indicator
- **AND** that indicator is removed once visible normalized output is available and is not retained as conversation history

#### Scenario: Active reasoning streams a readable preview

- **GIVEN** one reasoning segment is receiving live deltas
- **WHEN** the Side Panel renders that active segment
- **THEN** it automatically exposes a bounded preview of approximately five lines
- **AND** that preview follows the trailing recent lines as new reasoning arrives rather than remaining at the beginning
- **AND** when another visible item becomes active or the turn completes, the reasoning card collapses
- **AND** the completed card remains manually expandable to its full retained text

### Requirement: Live message cards preserve event order

Panerelay SHALL segment presentation of a logical assistant message when another visible timeline item separates its output, even when the provider reuses one message identifier.

#### Scenario: One message identifier spans a tool call

- **GIVEN** an assistant message delta arrives before a tool activity
- **AND** a later assistant delta with the same message identifier arrives after that activity
- **WHEN** the Side Panel renders the timeline and later receives message completion
- **THEN** the pre-tool and post-tool text remain in distinct message cards around the tool
- **AND** completion does not move or duplicate the post-tool text above the tool

#### Scenario: Multiple message cards stream during one turn

- **GIVEN** one assistant message card is marked as streaming
- **WHEN** a later message segment, reasoning card, tool activity, approval, or terminal output becomes visible
- **THEN** the earlier message card stops showing its progress indicator
- **AND** at most the latest active message card is marked as streaming

### Requirement: Message copy controls do not reserve content space

Panerelay SHALL overlay each message-copy control in the message card corner without adding permanent padding for the hidden control.

#### Scenario: Pointer and keyboard users access message copy

- **GIVEN** an idle copy control on a pointer-capable device
- **WHEN** the message card is not hovered and the control is not keyboard-focused
- **THEN** the control is visually hidden and does not reserve message-content space
- **AND** hovering that message card or focusing its copy control reveals it
- **AND** copied or failed status remains visible long enough to provide feedback

### Requirement: Copied diagnostics identify current tab and control context

Panerelay SHALL include the Extension's latest observed browser-active tab, authorized tab, controlled tabs, control-session summary, and content-free automation activity metadata in the versioned conversation diagnostic record created only by an explicit user copy action.

#### Scenario: Browser page and Agent target appear confused

- **GIVEN** a visible conversation appears to describe a different page than the browser's active tab
- **WHEN** the user copies conversation diagnostics
- **THEN** the record identifies the active, authorized, and controlled tabs with their current titles and URLs
- **AND** includes opaque target correlation and activity status metadata without page snapshots, request bodies, cookies, credentials, or raw tool output
- **AND** copying the record does not perform a browser read, persist the record, grant authorization, or acquire control
