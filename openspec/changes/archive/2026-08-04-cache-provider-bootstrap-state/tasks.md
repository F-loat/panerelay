## 1. Provider Bootstrap Cache

- [x] 1.1 Add versioned minimal provider-cache serialization, validation, and current-catalog filtering.
- [x] 1.2 Load the saved provider and cache before production React mount and initialize controller state from the validated snapshot.
- [x] 1.3 Refresh the cache best-effort after successful live provider discovery and preparation refresh while keeping actions live-gated.
- [x] 1.4 Render neutral connection copy throughout initialization and preserve existing live fallback behavior.

## 2. Tests and Verification

- [x] 2.1 Add provider-cache unit tests plus component/controller regressions for first-render selection, no false unavailable/premature-connected state, invalid cache, stale live replacement, and write failure containment.
- [x] 2.2 Run Extension scoped tests/typecheck/build, full workspace checks, OpenSpec strict validation, and `git diff --check`.
- [x] 2.3 Reload the unpacked daily-Chrome Side Panel twice and verify the selected provider/status no longer flashes to Codex unavailable before live refresh.
