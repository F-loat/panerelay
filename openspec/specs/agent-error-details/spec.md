# agent-error-details Specification

## Purpose

Define how Panerelay preserves bounded Agent failure diagnostics and presents them on demand without making routine conversation activity noisy or exposing successful tool output.

## Requirements

### Requirement: Failed Agent activity preserves diagnostic detail

Panerelay SHALL preserve a bounded provider-supplied error message for failed conversation activity while excluding successful tool results and arbitrary raw protocol payloads.

#### Scenario: Codex MCP tool fails

- **GIVEN** Codex reports a failed MCP tool item with an error message
- **WHEN** Panerelay converts it to conversation activity
- **THEN** the activity includes the bounded error message as diagnostic detail

#### Scenario: Qoder tool fails with displayable text

- **GIVEN** Qoder reports a failed tool update with displayable text content
- **WHEN** Panerelay converts it to conversation activity
- **THEN** the activity includes bounded text detail without forwarding raw input or output objects

#### Scenario: Tool succeeds

- **GIVEN** a tool completes successfully with page content or another result
- **WHEN** Panerelay converts it to conversation activity
- **THEN** Panerelay does not add that successful result as error detail

### Requirement: Error details are collapsed until requested

Panerelay SHALL render failed activity and conversation error messages in a compact collapsed state and let the user expand the item to read its complete available diagnostic detail.

#### Scenario: Failed activity has detail

- **GIVEN** a failed activity contains diagnostic detail
- **WHEN** the side panel renders it
- **THEN** the compact row is collapsed by default and clicking it expands a wrapped, selectable detail region

#### Scenario: Conversation error is long

- **GIVEN** a conversation or global error message exceeds the compact row width
- **WHEN** the user expands the error item
- **THEN** the full available message is visible without widening the card beyond the conversation column

#### Scenario: Failure has no additional detail

- **GIVEN** a failed activity contains only its title and status
- **WHEN** the side panel renders it
- **THEN** the row remains non-expandable and does not show an empty disclosure affordance

### Requirement: Working feedback surfaces current reasoning

Panerelay SHALL replace the generic working-state description with the latest available Agent reasoning summary while a turn is still thinking.

#### Scenario: Reasoning arrives before an answer

- **GIVEN** a turn is running and the Agent emits reasoning-summary deltas
- **WHEN** the side panel renders the working feedback card
- **THEN** the card shows a bounded latest reasoning preview with the running indicator instead of the generic progress description

#### Scenario: No reasoning is available

- **GIVEN** a turn is running without a reasoning summary
- **WHEN** the side panel renders the working feedback card
- **THEN** the card keeps the localized generic progress description

#### Scenario: Answer streaming begins

- **GIVEN** current reasoning is shown in the working feedback card
- **WHEN** an assistant answer delta arrives
- **THEN** the working card closes and the completed reasoning remains available in the conversation timeline
