## ADDED Requirements

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
