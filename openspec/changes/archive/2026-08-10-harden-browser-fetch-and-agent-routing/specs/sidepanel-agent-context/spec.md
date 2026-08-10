## MODIFIED Requirements

### Requirement: New conversations receive bounded current-page metadata

PaneRelay SHALL orient a newly created Side Panel conversation with the active page URL and title captured for the first draft send and, when available, a bounded target hint containing only the originating browser's opaque registration ID and the Extension-generated opaque target ID. It SHALL label URL and title values as untrusted metadata and SHALL identify the target hint as staleable locating data rather than authority. It MAY provide bounded engine-specific commands that consume the target hint through an already configured user-owned automation tool. Panerelay-owned Codex and Claude Code Providers MAY inject only the bounded Panerelay Fetch MCP tool described by `agent-web-fetch-routing`; they MUST NOT inject another browser tool definition or MCP server, a credential, raw Chrome tab ID, authorization state, control state, or project directory duplicated as prompt metadata. The separately selected canonical project directory SHALL continue to be used as the Agent's actual working directory.

#### Scenario: First send includes current page context

- **GIVEN** an eligible active tab has a URL, title, and opaque target identity and its workspace is an unbound draft
- **WHEN** the user sends the first message
- **THEN** the new Agent conversation receives bounded URL and title metadata plus the opaque browser and target hint describing the current page
- **AND** any engine-specific targeting guidance uses only the Agent's existing configured tools and the opaque hint

#### Scenario: Sensitive URL components are bounded

- **GIVEN** the active page URL contains a long value or a credential-like query or fragment value
- **WHEN** PaneRelay creates initial page context
- **THEN** it limits and redacts the URL before the value reaches the Agent provider

#### Scenario: Chrome tab and control state stay private

- **GIVEN** a new conversation is bound to an Extension-private tab workspace
- **WHEN** PaneRelay creates its initial page context
- **THEN** the Agent receives only opaque browser and target identifiers rather than a raw Chrome tab ID, authorization state, or control state
- **AND** browser actions continue through the Agent's own configured tools and the existing authorization and control policies

#### Scenario: Target hint is stale or unauthorized

- **GIVEN** the conversation contains a target hint whose tab closed, whose Extension target identity was replaced, or which is not in the selected automation participant's authorized target set
- **WHEN** the Agent attempts the documented target-selection command
- **THEN** Panerelay returns an explicit unavailable or unauthorized result
- **AND** it does not select another tab, widen authorization, or acquire control from the hint

#### Scenario: Selected project remains the working directory

- **GIVEN** the user selected a valid canonical project directory for the draft
- **WHEN** PaneRelay creates the provider conversation
- **THEN** the provider runs the Agent in that directory
- **AND** PaneRelay does not duplicate the directory path into the tab-context prompt

#### Scenario: Page metadata is unavailable

- **GIVEN** Chrome cannot provide a readable URL, title, or opaque target identity for the active tab
- **WHEN** the first message creates a conversation
- **THEN** PaneRelay omits each unavailable value and continues without inventing it, injecting an unrelated browser tool definition, or widening authorization
