## MODIFIED Requirements

### Requirement: History is loaded on demand

The Side Panel SHALL load the selected provider's conversation history when the user opens the history picker, SHALL merge provider-listed summaries with valid Extension-retained summaries from the current Chrome session, and SHALL NOT automatically list or resume conversations when the Side Panel opens or the provider changes. Matching provider and conversation identifiers SHALL appear once, with provider-returned metadata taking precedence, and the resulting list SHALL be ordered by recent update time.

#### Scenario: Opening the Side Panel

- **WHEN** an unbound tab opens the Side Panel
- **THEN** the Side Panel shows a new local draft without listing or resuming provider conversations

#### Scenario: Opening history

- **WHEN** the user opens the conversation history picker
- **THEN** the Side Panel loads the selected provider's recent provider and Extension-retained conversations and shows loading, empty, success, or retryable error state in that picker

#### Scenario: Codex history was created elsewhere

- **WHEN** Codex has resumable, non-archived conversations created by another Codex client or in another working directory
- **THEN** the Side Panel includes them in the recent Codex history without filtering by source kind or working directory

#### Scenario: Provider and cache contain the same conversation

- **GIVEN** provider history and the current Chrome session cache contain summaries with the same provider and conversation identifiers
- **WHEN** the user opens history
- **THEN** the Side Panel shows that conversation once using current provider metadata

#### Scenario: Qoder cannot list sessions

- **GIVEN** Qoder cannot list provider sessions but valid Qoder conversation summaries remain in the Extension's current-session cache
- **WHEN** the user opens history
- **THEN** the Side Panel shows the retained Qoder conversations without presenting the unsupported provider list operation as a blocking error

#### Scenario: Provider listing fails without cached history

- **GIVEN** the selected provider's history request fails and no valid retained summary exists for that provider
- **WHEN** the user opens history
- **THEN** the history picker shows a retryable error and does not invent a conversation

#### Scenario: Chrome session ends

- **WHEN** Chrome ends the current browser session and later starts another session
- **THEN** the history picker does not show Extension-retained summaries from the prior session
- **AND** provider-owned history remains independently available when the provider can list it

#### Scenario: Changing providers

- **WHEN** the user selects a different provider for an unbound draft
- **THEN** the Side Panel keeps a new draft for that provider and does not resume its newest provider or retained conversation

### Requirement: Users explicitly select history

The Side Panel SHALL let the user search loaded provider and Extension-retained conversation metadata and SHALL resume only the conversation they explicitly select. A retained summary SHALL be treated only as a resume candidate and SHALL NOT cause workspace binding until the matching provider successfully resumes or loads that conversation.

#### Scenario: Searching loaded history

- **WHEN** the user enters a search term in the history picker
- **THEN** the picker filters loaded conversations by visible title, preview, or identifier without resuming a conversation

#### Scenario: Selecting a provider-listed conversation

- **WHEN** the user selects a provider-listed conversation from history
- **THEN** Panerelay resumes that conversation and moves the active tab into its conversation workspace

#### Scenario: Selecting a retained conversation

- **GIVEN** a retained conversation is absent from provider listing but its provider advertises resume or load support
- **WHEN** the user explicitly selects that retained conversation
- **THEN** Panerelay requests provider resume for its opaque identifier before changing the active tab workspace
- **AND** displays the retained timeline after resume succeeds

#### Scenario: Resume fails

- **WHEN** the selected provider or retained conversation cannot be resumed
- **THEN** the current draft or conversation and its tab workspace remain active
- **AND** the picker shows a retryable error
