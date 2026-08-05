## 1. Shared ACP transcript fallback

- [x] 1.1 Add bounded process-local message retention to shared ACP session state.
- [x] 1.2 Record visible user text and completed assistant messages without retaining first-turn context, reasoning, activities, approvals, or images.
- [x] 1.3 Make resume prefer non-empty normalized provider history and otherwise return the retained live transcript.

## 2. Regression coverage

- [x] 2.1 Add Qoder tests for empty load replay, provider-history precedence, message ordering, bounds, and context privacy.
- [x] 2.2 Add OpenCode coverage proving the shared fallback and existing provider-history behavior.
- [x] 2.3 Confirm Side Panel remount applies provider-resumed messages and does not restore browser authority.

## 3. Compatibility and validation

- [x] 3.1 Document Qoder 1.1.2 and OpenCode 1.18.12 message-restoration status and process-local limitations.
- [x] 3.2 Run package-scoped tests, typechecks, lint/format checks, strict OpenSpec validation, full workspace checks, and `git diff --check`.
- [ ] 3.3 Perform a real daily-Chrome close/reopen check with Qoder 1.1.2, capture post-remount diagnostics, and clean up the test session without changing browser authorization.
