## ADDED Requirements

### Requirement: Users can copy a normalized conversation diagnostic record

The Side Panel SHALL provide a user-triggered Debug action in settings, immediately before the GitHub action, when the current view has a conversation or timeline content. It SHALL omit the action when there is no diagnostic conversation state. The action copies a versioned, structured diagnostic record of the current normalized conversation state. The record SHALL preserve the current timeline order and distinguish messages, reasoning, activities, approvals, and errors. It SHALL include the available identifiers, statuses, timestamps, streaming markers, selected provider metadata, conversation summary, workspace kind, active-turn state, panel instance, conversation load source, and a bounded metadata-only normalized-event trace needed to compare live and restored presentation.

#### Scenario: Settings has no conversation to diagnose

- **GIVEN** the current Side Panel view has no current conversation and an empty timeline
- **WHEN** the user opens settings
- **THEN** the Debug diagnostic action is not displayed
- **AND** the GitHub action remains available

#### Scenario: Copying a live conversation

- **GIVEN** the current Side Panel timeline contains assistant messages separated by tool activity
- **WHEN** the user invokes the diagnostic copy action
- **THEN** the clipboard receives one structured record whose timeline entries retain their current displayed order
- **AND** each entry identifies its type and includes the available correlation fields
- **AND** message text remains readable while reasoning and activity output are represented only by deterministic size metadata
- **AND** the normalized event trace can show that an existing message ID was updated after an intervening activity without copying event text or raw payloads

#### Scenario: Copying a restored conversation

- **GIVEN** the user resumed a provider conversation after reopening the Side Panel
- **WHEN** the user invokes the diagnostic copy action
- **THEN** the record contains exactly the normalized messages and timeline entries currently held by the Side Panel
- **AND** it includes panel-instance, load-source, provider, conversation, workspace, and active-turn metadata that identify the restored state

#### Scenario: Copy succeeds

- **GIVEN** the browser permits a clipboard write from the user gesture
- **WHEN** the diagnostic record is copied
- **THEN** the Side Panel announces localized success and does not alter the conversation or browser-control state

#### Scenario: Copy fails

- **GIVEN** both the clipboard API and the supported user-gesture fallback fail
- **WHEN** the user invokes the diagnostic copy action
- **THEN** the Side Panel announces a localized failure
- **AND** the conversation remains unchanged so the user can retry

### Requirement: Diagnostic copying remains explicit and privacy-bounded

Panerelay SHALL generate the copied record only in response to the user's copy action and only from normalized state already held by the Side Panel. It MUST NOT fetch or append cookies, credentials, raw ACP or CDP payloads, screenshots, request bodies, hidden prompts, reasoning text, raw activity output, page DOM, browser profile data, or additional page content, and it MUST NOT persist or transmit the record automatically. The normalized event trace MUST omit message deltas, completed message text, activity output and detail, approval descriptions, and error text.

#### Scenario: Diagnostic record is generated

- **GIVEN** the current conversation was created while a browser tab was authorized
- **WHEN** the user copies its diagnostic record
- **THEN** the record contains the normalized conversation and activity fields already available to the Side Panel
- **AND** Panerelay performs no new page read, browser attachment, control acquisition, upload, telemetry submission, or disk persistence

#### Scenario: No copy action occurs

- **GIVEN** the Side Panel displays or restores a conversation
- **WHEN** the user does not invoke the diagnostic copy action
- **THEN** Panerelay does not generate, persist, or transmit a diagnostic record in the background

### Requirement: Users can copy one message as Markdown

Each user and assistant message card SHALL expose a localized copy action at its top-right when the card is hovered or contains keyboard focus. Invoking the action SHALL copy only that message's original Markdown source, preserving Markdown syntax such as headings, tables, links, and fenced code blocks without adding role labels, timestamps, or diagnostic metadata.

#### Scenario: Copying an assistant message

- **GIVEN** an assistant card contains rendered Markdown with a table or fenced code block
- **WHEN** the user invokes that card's copy action
- **THEN** the clipboard receives the original Markdown source for only that card
- **AND** the conversation timeline remains unchanged

#### Scenario: Accessing copy without hover

- **GIVEN** the user navigates the conversation with a keyboard or a device without hover
- **WHEN** the message card or its copy action receives focus
- **THEN** the copy action remains visible and has a localized accessible name
