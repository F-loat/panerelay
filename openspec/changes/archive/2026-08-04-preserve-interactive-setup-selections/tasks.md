## 1. Current setup state

- [x] 1.1 Implement a side-effect-free resolver that derives selected integrations and the shared default from current valid protected Panerelay Provider, adapter registration, and default state.
- [x] 1.2 Add resolver tests for all, partial, empty, mixed-default, malformed, and unprotected current configuration without executable inference.

## 2. Desired-state lifecycle

- [x] 2.1 Add an internal interactive reconciliation option that installs or updates checked integrations and invokes existing scoped uninstallers for unchecked integrations in deterministic sequence.
- [x] 2.2 Reconcile selected defaults in both directions while preserving unrelated defaults, upstream automation engines, Native Host state, and explicit-flag additive behavior.
- [x] 2.3 Extend lifecycle tests for all-selected, partially selected, empty selection, default clearing, Browser Use detached-daemon reporting, upstream preservation, and thrown-step behavior.

## 3. Interactive CLI

- [x] 3.1 Initialize the multiselect and shared confirmation from current protected configuration without creating a second persisted selection state.
- [x] 3.2 Localize the desired-state prompt so checked install/update and unchecked Panerelay-integration removal are explicit in English and Simplified Chinese.
- [x] 3.3 Extend CLI tests for all, partial, empty, mixed-default, invalid, cancelled, failed, explicit, and non-interactive selections.
- [x] 3.4 Show localized timer progress after the final interactive answer and test both successful and failed reconciliation feedback.
- [x] 3.5 Remove the optional Agent-tools group from setup completion output while retaining doctor diagnostics and coverage for both present and missing tools.

## 4. Verification and cleanup

- [x] 4.1 Run package-scoped formatting, typechecks, and tests while confirming temporary integration fixtures are cleaned up.
- [x] 4.2 Run an isolated TTY-equivalent setup rerun that verifies initial selections, uncheck removal, upstream executable preservation, and restoration of removed Panerelay test artifacts.
- [x] 4.3 Confirm the previously accepted daily-Chrome browser evidence remains applicable because reconciliation changes only local setup artifacts and does not touch browser authorization or control state.
- [x] 4.4 Confirm compatibility documentation remains accurate with agent-browser 0.33.0, Browser Use 0.13.7/Browser Harness 0.1.8, and Playwright CLI 0.1.17 classifications unchanged; update it only if evidence differs.
- [x] 4.5 Run `pnpm install --frozen-lockfile`, `pnpm run check`, strict OpenSpec validation, and `git diff --check`.
