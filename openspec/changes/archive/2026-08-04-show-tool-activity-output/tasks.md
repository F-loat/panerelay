## 1. Normalized Tool Output

- [x] 1.1 Add a bounded optional output field to the shared conversation activity contract without changing existing event consumers.
- [x] 1.2 Normalize only explicit ACP text content into successful activity output, preserve content replacement semantics, retain failed text as detail, and exclude raw/native values.
- [x] 1.3 Add Qoder and shared ACP provider regressions for completed output, omitted-content completion, explicit clearing, bounds, failure detail, and raw/image/terminal exclusion.

## 2. Side Panel Presentation

- [x] 2.1 Render activity output only inside the expanded terminal disclosure, separately from the full title and diagnostic detail, with wrapped selectable styling.
- [x] 2.2 Add component regressions proving collapsed cards hide output, expanded cards show it, and failure/setup presentation remains unchanged.

## 3. Verification and Compatibility

- [x] 3.1 Run Bridge and Extension scoped tests/typechecks, the full workspace check, OpenSpec validation, and `git diff --check`.
- [x] 3.2 Verify one completed Qoder command with displayable output in an explicitly opened daily-Chrome Side Panel, then close the test conversation and remove any local fixture output.
- [x] 3.3 Review Qoder/OpenCode compatibility documentation and record only the tested capability level; do not promote ACP output rendering beyond automated or directly observed evidence.
