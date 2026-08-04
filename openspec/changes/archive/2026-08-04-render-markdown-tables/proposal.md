## Why

The Side Panel's lightweight Markdown renderer treats GitHub-flavored table source as one wrapped paragraph. Structured Agent answers such as article lists and comparison matrices therefore become difficult to scan in the narrow conversation column.

## What Changes

- Recognize standard pipe-table syntax with a header row, delimiter row, optional leading/trailing pipes, and left, center, or right column alignment markers.
- Render semantic table, header, row, and cell elements while preserving the existing safe inline Markdown subset inside each cell.
- Keep wide tables inside the message bubble with horizontal scrolling instead of compressing columns into unreadable text or widening the Side Panel.
- Leave malformed or incomplete table-looking text as ordinary Markdown text rather than guessing a table structure.

Non-goals:

- This change does not add raw HTML, rowspan/colspan, multiline cells, nested block Markdown, spreadsheet editing, or a general-purpose third-party Markdown runtime.
- It does not change Agent output, browser authorization, browser ownership, control, or any automation engine behavior.
- The agent-browser 0.33.0, Browser Use 0.13.7 / Browser Harness 0.1.8, Playwright CLI 0.1.17, and provider compatibility groups are unaffected.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-history-workflow`: Assistant and user message Markdown gains safe, responsive GitHub-flavored pipe-table presentation.

## Impact

- Extension Side Panel: lightweight rich-text parser, message styling, and component tests.
- No shared protocol, Bridge, external dependency, RFC, compatibility matrix, or persisted-data change.
