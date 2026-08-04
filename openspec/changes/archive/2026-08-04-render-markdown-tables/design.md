## Context

See [proposal.md](./proposal.md) for motivation. The Side Panel intentionally uses a small React-based Markdown subset instead of HTML injection or a general Markdown dependency. Block parsing currently recognizes fenced code, headings, quotes, lists, rules, and paragraphs; pipes have no block meaning, so a table is folded into a paragraph. Inline parsing creates React nodes for code, emphasis, and allowlisted HTTP(S) links and therefore already provides the safe cell-content boundary needed here.

No accepted RFC is affected because this is local conversation presentation with no protocol, provider, browser, permission, or ownership change.

## Goals / Non-Goals

**Goals:**

- Add the common GitHub-flavored pipe-table shape without weakening the existing no-raw-HTML boundary.
- Keep parsing deterministic for streamed or malformed text and preserve ordinary paragraph behavior until a complete header/delimiter pair exists.
- Make tables readable at narrow Side Panel widths and accessible through native semantic elements.

**Non-Goals:**

- Do not implement the complete CommonMark/GFM grammar, nested block content in cells, multiline rows, or HTML table syntax.
- Do not introduce a third-party parser for this bounded feature.
- Do not claim provider compatibility evidence; table rendering is an Extension component behavior covered by automated tests.

## Decisions

### Recognize a table only from a complete two-line prefix

Before paragraph parsing, the renderer checks whether the current line contains a pipe-separated header and the next line contains the same number of delimiter cells. Each delimiter must match an optional leading colon, at least three hyphens, and an optional trailing colon. Optional outer pipes are removed, and surrounding cell whitespace is trimmed.

Requiring the complete prefix means streamed text stays an ordinary paragraph until the delimiter arrives, after which React rerenders it as a table. Treating every pipe line as a table was rejected because shell commands, prose, and TypeScript unions commonly contain pipes.

### Split only unescaped structural pipes

The row scanner treats a backslash-escaped pipe as cell text and does not split pipes inside an inline code span. Rows are normalized to the header column count: missing trailing cells become empty, and extra cells are folded into the final cell rather than widening the schema. Body collection stops at a blank line or a line without a structural pipe.

Using a single regular expression was rejected because escaped/code-span pipes make it difficult to preserve cell text safely and predictably.

### Reuse safe inline rendering inside semantic cells

Headers use `<th scope="col">`; body content uses `<td>`. Each cell passes through the existing inline renderer, so React escapes plain text and only the current code, emphasis, and HTTP(S) link forms become elements. Alignment is derived only from the delimiter and exposed through fixed `data-align` values for CSS.

Raw HTML support was rejected because it would expand the trust surface for Agent-authored content and is unnecessary for the requested table shape.

### Contain width with one scroll wrapper

The table is placed in a `max-width: 100%` overflow wrapper. The table uses intrinsic content width with a 100% minimum, fixed visual borders, and nowrap header/cell content so a wide matrix scrolls horizontally rather than squeezing Chinese text and numeric columns into vertical fragments. The message bubble retains `min-width: 0`, preventing the table from widening the conversation layout.

## Risks / Trade-offs

- [A partial streamed table changes from paragraph to table after the delimiter arrives] → Accept the deterministic rerender; the semantic structure cannot be known safely before the delimiter is complete.
- [Very long cell content creates horizontal scrolling] → Contain it inside the table wrapper and preserve selectable content instead of widening the Side Panel.
- [Advanced GFM edge cases are unsupported] → Fail back to ordinary safe text rather than guessing; keep the accepted grammar explicit and tested.
- [Escaped pipes lose their escape marker] → Consume only the structural backslash needed to display a literal pipe, matching user intent without enabling HTML.

## Migration Plan

1. Add table-prefix and row parsing to the existing rich-text renderer.
2. Add semantic, responsive styles and focused component tests for alignment, inline content, overflow containment, and malformed input.
3. Rollback removes the table branch and styles; messages remain stored as unchanged Markdown source.
