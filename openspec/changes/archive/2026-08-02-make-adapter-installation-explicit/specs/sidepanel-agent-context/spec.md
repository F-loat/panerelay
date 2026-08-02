## MODIFIED Requirements

### Requirement: New conversations receive bounded current-page metadata

PaneRelay SHALL orient a newly created Side Panel conversation with only the active page URL and title captured for the first draft send and SHALL label those values as untrusted metadata. It MUST NOT expose a raw Chrome tab ID, authorization state, control state, project directory duplicated as prompt metadata, or an instruction to use agent-browser, Browser Use, or another browser tool. The separately selected canonical project directory SHALL continue to be used as the Agent's actual working directory.

#### Scenario: First send includes current page context

- **GIVEN** an eligible active tab has a URL and title and its workspace is an unbound draft
- **WHEN** the user sends the first message
- **THEN** the new Agent conversation receives bounded URL and title metadata describing the current page
- **AND** it receives no Panerelay-injected browser MCP, Skill, or engine instruction

#### Scenario: Sensitive URL components are bounded

- **GIVEN** the active page URL contains a long value or a credential-like query or fragment value
- **WHEN** PaneRelay creates initial page context
- **THEN** it limits and redacts the URL before the value reaches the Agent provider

#### Scenario: Chrome tab and control state stay private

- **GIVEN** a new conversation is bound to an Extension-private tab workspace
- **WHEN** PaneRelay creates its initial page context
- **THEN** the Agent receives no raw Chrome tab ID, authorization state, or control state
- **AND** browser actions continue to use the Agent's own configured tools and existing opaque target discovery and authorization

#### Scenario: Selected project remains the working directory

- **GIVEN** the user selected a valid canonical project directory for the draft
- **WHEN** PaneRelay creates the provider conversation
- **THEN** the provider runs the Agent in that directory
- **AND** PaneRelay does not duplicate the directory path into the tab-context prompt

#### Scenario: Page metadata is unavailable

- **GIVEN** Chrome cannot provide a readable URL or title for the active tab
- **WHEN** the first message creates a conversation
- **THEN** PaneRelay omits the unavailable metadata and continues without inventing values, injecting a browser tool, or widening authorization
