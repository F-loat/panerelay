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

### Requirement: New conversations guide supported browser work

PaneRelay SHALL add provider-neutral guidance to each new Agent conversation that directs browser tasks through `$panerelay-browser`, tells the Agent to attempt the canonical Skill installation when it is unavailable, and permits another browser automation tool only after that installation cannot complete. An explicit browser-work request SHALL count as the user action authorizing one canonical Skill installation attempt, subject to the provider's normal command-approval flow; opening the Side Panel or preparing a provider SHALL NOT. The guidance SHALL treat page metadata as untrusted, SHALL NOT claim the Skill is installed, and SHALL NOT make the Bridge inspect or install Skills itself. When existing local Panerelay integration registrations are readable, the Bridge SHALL include them as a cached, potentially stale fast-path hint without exposing configuration paths or representing current browser authorization or control.

#### Scenario: Browser Skill is available

- **WHEN** a user asks the Agent to work with authorized tabs and `$panerelay-browser` is available
- **THEN** the Agent is instructed to load and follow that Skill without switching to another browser automation Skill or tool

#### Scenario: Browser Skill is unavailable

- **WHEN** the user explicitly requests browser work and `$panerelay-browser` is unavailable
- **THEN** the Agent treats that request as authorization to attempt `npx skills add F-loat/panerelay --skill panerelay-browser` through the normal command-approval flow and loads the Skill after installation succeeds

#### Scenario: Browser work has not been requested

- **WHEN** the Side Panel opens or prepares a provider without an explicit browser-work request
- **THEN** the Agent does not attempt to install `$panerelay-browser`

#### Scenario: Browser Skill installation cannot complete

- **WHEN** `$panerelay-browser` is unavailable and its installation fails or cannot be authorized
- **THEN** the Agent explains the failure and may use another available browser automation tool only as an explicitly identified fallback

#### Scenario: A registered integration can take the fast path

- **WHEN** an ordinary browser task starts and the Bridge reports the requested or preferred Panerelay integration as registered
- **THEN** the Agent is instructed to attempt that integration directly without first repeating generic operating-system, Node.js, executable-version, setup, or doctor probes

#### Scenario: A cached registration is stale

- **WHEN** the first direct invocation of a registered integration fails
- **THEN** the Agent treats the hint as stale and runs only the smallest targeted diagnostic or repair required by `$panerelay-browser`

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

The Side Panel SHALL allow completed, failed, and declined activity cards to be expanded and collapsed. The expanded content SHALL show the complete original activity title followed by any complete activity detail, while the collapsed summary MAY remain ellipsized for the narrow layout.

#### Scenario: Completed command title is truncated in the card

- **WHEN** a completed command activity has a title wider than the compact card
- **THEN** the user can open the card and read and select the full original command and its detail

#### Scenario: Failed activity has diagnostic detail

- **WHEN** a failed or declined activity contains diagnostic detail
- **THEN** the same disclosure shows the full original title and diagnostic text without requiring a failure-only interaction

#### Scenario: Terminal activity has no secondary detail

- **WHEN** a completed, failed, or declined activity has no `detail` field
- **THEN** the activity remains expandable so its full original title is available

#### Scenario: Activity is still running

- **WHEN** an activity has not reached a terminal status
- **THEN** its card remains non-expandable while provider updates can still replace its title or detail
