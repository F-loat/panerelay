## 1. Diagnostic serialization

- [x] 1.1 Add a pure versioned serializer that selects provider, conversation, workspace, active-turn, and ordered type-specific timeline fields from current Side Panel state.
- [x] 1.2 Add unit coverage for live and restored-shaped timelines, stable indexes, correlation fields, streaming state, and excluded unrelated Side Panel/browser fields.
- [x] 1.3 Extract and test the existing clipboard API plus user-gesture fallback for reuse by diagnostics and setup guidance.
- [x] 1.4 Add panel/load provenance, turn correlation, and a bounded metadata-only normalized event trace while summarizing reasoning and tool content.

## 2. Side Panel interaction

- [x] 2.1 Move the localized diagnostic action into the settings action area immediately before GitHub, use a Debug icon, and hide it when there is no conversation state to capture.
- [x] 2.2 Keep accessible localized diagnostic success and failure feedback in settings without mutating conversation, workspace, authorization, or control state.
- [x] 2.3 Add a hover/focus copy action to each user and assistant message card that copies only the card's original Markdown source.
- [x] 2.4 Add component regressions for diagnostic JSON order/privacy/correlation, settings placement and feedback, message Markdown copying, keyboard visibility, retryable failure, and empty-state visibility.

## 3. Verification and compatibility

- [x] 3.1 Record the provider-neutral diagnostic action in the affected OpenCode and Qoder compatibility notes without changing their compatibility status.
- [x] 3.2 Run Extension scoped formatting, linting, typecheck, and tests plus strict OpenSpec validation and `git diff --check`.
- [x] 3.3 Build the Extension and verify in the daily Chrome Side Panel that a live or restored conversation copies parseable ordered JSON and leaves browser/page state unchanged. Evidence: the Qoder 1.1.2 Side Panel produced parseable ordered versioned records before and after remount while the authorized page remained unchanged; later schema revisions retained the same explicit local copy path under automated coverage.
- [x] 3.4 Run `pnpm install --frozen-lockfile` and the full workspace check.
