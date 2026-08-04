## MODIFIED Requirements

### Requirement: Failed Agent activity preserves diagnostic detail

Panerelay SHALL preserve a bounded provider-supplied error message for failed conversation activity while excluding successful tool results and arbitrary raw protocol payloads from diagnostic detail. A successful terminal tool MAY carry bounded displayable text in the separate activity output field, which MUST NOT be labeled or rendered as an error.

#### Scenario: Codex MCP tool fails

- **GIVEN** Codex reports a failed MCP tool item with an error message
- **WHEN** Panerelay converts it to conversation activity
- **THEN** the activity includes the bounded error message as diagnostic detail

#### Scenario: Qoder tool fails with displayable text

- **GIVEN** Qoder reports a failed tool update with displayable text content
- **WHEN** Panerelay converts it to conversation activity
- **THEN** the activity includes bounded text detail without forwarding raw input or output objects

#### Scenario: Tool succeeds

- **GIVEN** a tool completes successfully with displayable text content
- **WHEN** Panerelay converts it to conversation activity
- **THEN** Panerelay does not add that successful result as error detail
- **AND** it MAY preserve the bounded text in the separate activity output field
