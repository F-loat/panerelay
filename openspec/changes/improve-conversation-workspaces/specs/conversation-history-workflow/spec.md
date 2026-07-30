## Purpose

Define an explicit conversation workflow in which history is user-selected and new conversations
remain local drafts until the first message requires an Agent session.

## ADDED Requirements

### Requirement: History is loaded on demand

The Side Panel SHALL load a provider's conversation history when the user opens the history picker
and SHALL NOT automatically resume a conversation when the Side Panel opens or the provider
changes.

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

The Side Panel SHALL let the user search the loaded conversation metadata and resume only the
conversation they explicitly select.

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

Starting a new conversation SHALL clear the active tab workspace into a local draft and SHALL defer
provider conversation creation until the first non-empty message is sent.

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

The Side Panel SHALL show a transient live status while a message is waiting for conversation
creation or an Agent turn is running, without persisting that status as conversation content.

#### Scenario: First send waits for conversation creation

- **WHEN** the user sends the first message from a draft and provider conversation creation has not completed
- **THEN** the Side Panel immediately shows an animated conversation-starting status next to the optimistic user message

#### Scenario: Agent turn has started without visible output

- **WHEN** PaneRelay has accepted the message but the Agent has not produced a visible result
- **THEN** the Side Panel shows that the selected Agent is working until output, approval, completion, interruption, or failure provides a newer state

#### Scenario: Pending status is not conversation history

- **WHEN** the Side Panel restores or lists the conversation later
- **THEN** the transient starting or working status is absent from provider messages and conversation history
