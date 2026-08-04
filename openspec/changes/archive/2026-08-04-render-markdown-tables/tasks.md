## 1. Markdown Table Rendering

- [x] 1.1 Add deterministic pipe-row and delimiter parsing with optional outer pipes, escaped/code-span pipe handling, column normalization, and alignment metadata.
- [x] 1.2 Render valid tables with semantic headers and cells through the existing safe inline renderer while leaving incomplete table-like text as ordinary Markdown.
- [x] 1.3 Add responsive table styling that stays inside the message bubble and scrolls horizontally at narrow widths.

## 2. Tests and Verification

- [x] 2.1 Add Side Panel component regressions for semantic rows/cells, inline Markdown, alignment, escaped pipes, malformed input, and the overflow wrapper.
- [x] 2.2 Run Extension scoped tests/typechecks, the full workspace check, OpenSpec validation, and `git diff --check`.
- [x] 2.3 Verify the supplied Chinese article table in an unpacked daily-Chrome Side Panel at a narrow width, remove temporary fixture content, and confirm no version-specific compatibility documentation changes are warranted.
