## Purpose

Define an explicit conversation workflow in which history is user-selected and new conversations remain local drafts until the first message requires an Agent session.

## Requirements

### Requirement: History is loaded on demand

The Side Panel SHALL load a provider's conversation history when the user opens the history picker and SHALL NOT automatically resume a conversation when the Side Panel opens or the provider changes.

#### Scenario: Opening the Side Panel

- **WHEN** an unbound tab opens the Side Panel
- **THEN** the Side Panel shows a new local draft without listing or resuming provider conversations

#### Scenario: Opening history

- **WHEN** the user opens the conversation history picker
- **THEN** the Side Panel loads the selected provider's recent conversations and shows loading, empty, success, or retryable error state in that picker

#### Scenario: Codex history was created elsewhere

- **WHEN** Codex has resumable, non-archived conversations created by another Codex client or in another working directory
- **THEN** the Side Panel includes them in the recent Codex history without filtering by source kind or working directory

#### Scenario: Changing providers

- **WHEN** the user selects a different provider for an unbound draft
- **THEN** the Side Panel keeps a new draft for that provider and does not resume its newest conversation

### Requirement: Users explicitly select history

The Side Panel SHALL let the user search the loaded conversation metadata and resume only the conversation they explicitly select.

#### Scenario: Searching loaded history

- **WHEN** the user enters a search term in the history picker
- **THEN** the picker filters loaded conversations by visible title or identifier without resuming a conversation

#### Scenario: Selecting a conversation

- **WHEN** the user selects a conversation from history
- **THEN** PaneRelay resumes that conversation and binds it to the active tab workspace

#### Scenario: Resume fails

- **WHEN** the selected conversation cannot be resumed
- **THEN** the current draft or conversation remains active and the picker shows a retryable error

### Requirement: New conversations begin as drafts

Starting a new conversation SHALL clear the active tab workspace into a local draft and SHALL defer provider conversation creation until the first non-empty message is sent.

#### Scenario: Starting fresh while idle

- **WHEN** the user chooses new conversation while no Agent turn is running
- **THEN** PaneRelay clears the active workspace into an empty draft without creating a provider conversation

#### Scenario: Starting fresh during a turn

- **WHEN** the user chooses new conversation while an Agent turn is running
- **THEN** PaneRelay interrupts the active turn before clearing the workspace into an empty draft

#### Scenario: Sending the first draft message

- **WHEN** the user sends the first non-empty message from a draft
- **THEN** PaneRelay starts exactly one provider conversation, binds it to the active tab workspace, and sends the message

#### Scenario: Empty draft is never sent

- **WHEN** a draft is abandoned, the provider changes, or the Side Panel closes before a message is sent
- **THEN** no empty provider conversation is persisted

### Requirement: Pending sends remain visibly active

The Side Panel SHALL show a transient live status while a message is waiting for conversation creation or an Agent turn is running, without persisting that status as conversation content.

#### Scenario: First send waits for conversation creation

- **WHEN** the user sends the first message from a draft and provider conversation creation has not completed
- **THEN** the Side Panel immediately shows an animated conversation-starting status next to the optimistic user message

#### Scenario: Agent turn has started without visible output

- **WHEN** PaneRelay has accepted the message but the Agent has not produced a visible result
- **THEN** the Side Panel shows that the selected Agent is working until output, approval, completion, interruption, or failure provides a newer state

#### Scenario: Pending status is not conversation history

- **WHEN** the Side Panel restores or lists the conversation later
- **THEN** the transient starting or working status is absent from provider messages and conversation history

### Requirement: Internal conversation context stays out of user-visible history

Panerelay SHALL preserve provider-neutral guidance and bounded page orientation for the Agent while excluding Panerelay-authored context from messages presented as user-authored conversation history. New ACP context MUST use the exact `<panerelay-context version="1">` / `</panerelay-context>` boundary. History normalization MUST preserve the user's complete bounded text, MUST match the v1 boundary literally rather than accepting loose XML-like variants, MUST NOT use broad keyword redaction, and MUST NOT expose internal context merely because a provider persists it in a user-message-shaped transcript entry.

#### Scenario: Versioned context is loaded from ACP history

- **GIVEN** an ACP conversation was created with a literal `<panerelay-context version="1">` context envelope before its user content
- **WHEN** the user resumes that conversation
- **THEN** the Side Panel shows the complete real user message and normalized assistant messages
- **AND** it does not render the Panerelay context envelope as a user message

#### Scenario: Legacy combined first prompt is loaded

- **GIVEN** a prior Panerelay version persisted its known bounded context prefix together with the first user message
- **WHEN** the user resumes that conversation
- **THEN** Panerelay removes only the recognized leading context envelope and preserves the complete remaining user text

#### Scenario: User writes similar instructional text

- **GIVEN** a user message contains words or sentences that resemble part of Panerelay guidance but is not a recognized leading context envelope
- **WHEN** Panerelay normalizes loaded history
- **THEN** it preserves that user message unchanged

#### Scenario: Legacy image-only first turn is loaded

- **GIVEN** a prior Panerelay version persisted only its known context text alongside an image-only first turn
- **WHEN** the user resumes that conversation
- **THEN** Panerelay omits the context-only text entry instead of presenting it as user-authored text
- **AND** it does not invent replacement user text or alter assistant history

### Requirement: New conversations guide supported browser work

PaneRelay SHALL add provider-neutral guidance to each new Agent conversation that directs browser-authenticated Fetch, Panerelay setup, and browser automation tasks through `$panerelay`, tells the Agent to attempt the canonical Skill installation when it is unavailable, and permits another browser automation tool only after that installation cannot complete. An explicit Panerelay-work request SHALL count as the user action authorizing one canonical Skill installation attempt, subject to the provider's normal command-approval flow; opening the Side Panel or preparing a provider SHALL NOT. The guidance SHALL treat page metadata as untrusted, SHALL NOT claim the Skill is installed, and SHALL NOT make the Bridge inspect or install Skills itself. When existing local Panerelay integration registrations are readable, the Bridge SHALL include them as a cached, potentially stale fast-path hint without exposing configuration paths or representing current browser authorization or control.

#### Scenario: Browser Skill is available

- **WHEN** a user asks the Agent to use Panerelay and `$panerelay` is available
- **THEN** the Agent is instructed to load and follow that Skill without switching to another browser automation Skill or tool

#### Scenario: Browser Skill is unavailable

- **WHEN** the user explicitly requests Panerelay work and `$panerelay` is unavailable
- **THEN** the Agent treats that request as authorization to attempt `npx skills add https://github.com/F-loat/panerelay --skill panerelay` through the normal command-approval flow and loads the Skill after installation succeeds

#### Scenario: Browser work has not been requested

- **WHEN** the Side Panel opens or prepares a provider without an explicit browser-work request
- **THEN** the Agent does not attempt to install `$panerelay`

#### Scenario: Browser Skill installation cannot complete

- **WHEN** `$panerelay` is unavailable and its installation fails or cannot be authorized
- **THEN** the Agent explains the failure and may use another available browser automation tool only as an explicitly identified fallback

#### Scenario: A registered integration can take the fast path

- **WHEN** an ordinary browser task starts and the Bridge reports the requested or preferred Panerelay integration as registered
- **THEN** the Agent is instructed to attempt that integration directly without first repeating generic operating-system, Node.js, executable-version, setup, or doctor probes

#### Scenario: A cached registration is stale

- **WHEN** the first direct invocation of a registered integration fails
- **THEN** the Agent treats the hint as stale and runs only the smallest targeted diagnostic or repair required by `$panerelay`

#### Scenario: Registration does not grant browser authority

- **WHEN** the Bridge includes a registered integration in the setup hint
- **THEN** the guidance does not claim that the Extension is connected, any tab is authorized, or a control lease exists

#### Scenario: Conversation has no page metadata

- **WHEN** a new conversation starts without a readable page URL or title
- **THEN** PaneRelay still supplies the Skill guidance without fabricating page context

### Requirement: Live output follows user scroll intent

The Side Panel SHALL keep the timeline pinned to new and streamed output while the user is following the bottom and SHALL preserve the user's reading position after the user deliberately scrolls upward.

#### Scenario: Output arrives while following the bottom

- **WHEN** the timeline was at or near the bottom before new content changed its height
- **THEN** the Side Panel scrolls to the updated bottom after rendering the content

#### Scenario: User is reading earlier content

- **WHEN** the user scrolls far enough above the bottom before new output arrives
- **THEN** the Side Panel does not pull the viewport away from that reading position

#### Scenario: User sends a message

- **WHEN** the user submits a message from the composer
- **THEN** the Side Panel returns the active timeline to the bottom so the optimistic message and subsequent output remain visible

### Requirement: Terminal activity details remain readable

The Side Panel SHALL allow completed, failed, and declined activity cards to be expanded and collapsed. The expanded content SHALL show the complete original activity title followed by any bounded provider-supplied output and complete activity detail in distinct regions, while the collapsed summary MAY remain ellipsized for the narrow layout and MUST NOT expose output that was intended for the expanded view.

#### Scenario: Completed command title is truncated in the card

- **GIVEN** a completed command activity has a title wider than the compact card
- **WHEN** the user opens the activity card
- **THEN** the user can read and select the full original command and any available bounded output or detail

#### Scenario: Completed command has displayable output

- **GIVEN** a completed command activity contains bounded provider-supplied text output
- **WHEN** the Side Panel first renders the collapsed card
- **THEN** the compact summary does not display the output
- **AND** opening the card shows the wrapped, selectable output separately from the command title

#### Scenario: Failed activity has diagnostic detail

- **GIVEN** a failed or declined activity contains diagnostic detail
- **WHEN** the user opens the activity card
- **THEN** the same disclosure shows the full original title and diagnostic text without requiring a failure-only interaction

#### Scenario: Terminal activity has no secondary content

- **GIVEN** a completed, failed, or declined activity has neither an `output` nor a `detail` field
- **WHEN** the Side Panel renders the activity
- **THEN** the activity remains expandable so its full original title is available

#### Scenario: Activity is still running

- **GIVEN** an activity has not reached a terminal status
- **WHEN** the Side Panel renders the activity
- **THEN** its card remains non-expandable while provider updates can still replace its title, output, or detail

### Requirement: Consecutive activity results stay compact by default

The Side Panel SHALL present an uninterrupted run of two or more normalized conversation activities as one collapsed activity group. The collapsed group summary SHALL expose the number of activities, the latest activity title, and an aggregate status that does not hide a running, failed, or declined activity. An open group SHALL use a neutral activity-log heading instead of repeating the latest activity title and SHALL show every constituent activity in timeline order as one lightweight list rather than as nested full-size cards. Each list row SHALL expose its individual title and status, and each terminal row SHALL remain independently expandable to reveal the same complete title, bounded output, and detail available to an individually rendered activity. A single activity SHALL keep its existing direct card presentation. The Side Panel MUST NOT group activities across a message, reasoning, approval, or error boundary, and presentation compaction MUST NOT merge or remove the individual normalized activities from retained timeline snapshots, event replay, or conversation diagnostics.

#### Scenario: Several commands run between messages

- **GIVEN** two or more activity items occur consecutively between conversation messages
- **WHEN** the Side Panel renders the timeline
- **THEN** it shows one collapsed activity group in that position instead of one top-level card per activity
- **AND** the group summary shows the activity count, latest activity title, and aggregate outcome

#### Scenario: User opens a compact activity group

- **GIVEN** a collapsed activity group contains completed, failed, declined, or running activities
- **WHEN** the user expands the group
- **THEN** the group heading no longer repeats the latest activity title
- **AND** every activity appears in original timeline order as a compact list row with its individual title and status
- **AND** the rows do not repeat the full-size card border and icon treatment of the outer group
- **AND** each terminal activity still exposes its complete title, bounded output, and detail

#### Scenario: Activity boundaries remain visible

- **GIVEN** activity runs are separated by an assistant message, reasoning item, approval, or error
- **WHEN** the Side Panel renders the timeline
- **THEN** it keeps the separating item in place and does not combine activities from opposite sides of that boundary

#### Scenario: One activity occurs by itself

- **GIVEN** a timeline activity is not consecutive with another activity
- **WHEN** the Side Panel renders it
- **THEN** it keeps the existing single activity card presentation without an extra grouping disclosure

#### Scenario: Compact presentation is retained and diagnosed

- **GIVEN** a visible activity group represents several normalized activity items
- **WHEN** Panerelay saves or restores the conversation timeline or copies conversation diagnostics
- **THEN** every original activity remains represented as an individual ordered record
- **AND** compaction does not change provider events, browser authorization, control ownership, or automation execution

### Requirement: Conversation Markdown tables remain structured and readable

The Side Panel SHALL render a valid GitHub-flavored pipe table in a user or assistant message as semantic table structure. It SHALL preserve the safe supported inline Markdown inside cells, apply declared left, center, or right column alignment, constrain the table to the message bubble with horizontal scrolling when needed, and MUST NOT interpret raw HTML or malformed table-like text as trusted structure.

#### Scenario: Assistant returns a valid table

- **GIVEN** an assistant message contains a header row, a valid delimiter row, and one or more pipe-delimited body rows
- **WHEN** the Side Panel renders the message
- **THEN** it exposes one semantic table with column headers and body cells in the original row order
- **AND** supported inline emphasis, code, and HTTP links inside cells retain their existing safe presentation

#### Scenario: Table declares column alignment

- **GIVEN** a valid table delimiter uses leading or trailing colons for left, center, or right alignment
- **WHEN** the Side Panel renders the table
- **THEN** every header and body cell in that column uses the declared alignment

#### Scenario: Table is wider than the message bubble

- **GIVEN** a valid table has more intrinsic width than the available conversation column
- **WHEN** the Side Panel renders it in a narrow Side Panel
- **THEN** the table remains inside the message bubble and its own wrapper can scroll horizontally
- **AND** the conversation column does not widen or collapse cells into one paragraph

#### Scenario: Table-looking text is incomplete

- **GIVEN** message text contains pipes but lacks a valid header and delimiter pair
- **WHEN** the Side Panel renders the message
- **THEN** it preserves that content as ordinary safe Markdown text without fabricating table semantics

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

### Requirement: ACP assistant message boundaries are preserved

The Bridge SHALL use each non-empty ACP assistant `messageId` as the correlation key for normalized live message events, and SHALL use one stable turn-scoped fallback when ACP omits a message ID.

#### Scenario: Multiple ACP messages share one turn

- **GIVEN** an active ACP turn emits assistant chunks with message IDs `commentary-1` and `final-1`
- **WHEN** the Bridge normalizes those chunks
- **THEN** it emits distinct normalized `message.delta` events for those IDs
- **AND** later chunks for each ID update only that message

#### Scenario: ACP omits a message ID

- **GIVEN** an active ACP turn emits assistant chunks without a usable message ID
- **WHEN** the Bridge normalizes those chunks
- **THEN** all such chunks use one stable fallback ID for that turn
- **AND** they remain one assistant message

### Requirement: Assistant messages retain chronological placement

The Side Panel SHALL place a newly observed assistant message at the point its first delta is received and SHALL NOT merge a later message into an earlier message merely because both belong to one turn.

#### Scenario: Final answer follows tool activity

- **GIVEN** the timeline receives message A, then a tool activity, then message B in one turn
- **WHEN** the Side Panel reduces those events
- **THEN** the timeline order is message A, tool activity, message B
- **AND** subsequent deltas for message B update only message B

### Requirement: Stream completion is per message

The Bridge SHALL emit one `message.completed` event for each streamed assistant message in first-seen order when the ACP prompt completes, and SHALL preserve the existing usage and turn terminal events after those message completions.

#### Scenario: Two streamed messages complete

- **GIVEN** an ACP turn streamed two non-empty assistant messages
- **WHEN** the prompt returns successfully
- **THEN** the Bridge emits two matching `message.completed` events with independent text
- **AND** it emits one completed turn event after both messages
