## 1. ACP normalization

- [x] 1.1 Replace the turn-wide assistant message accumulator with ordered per-message accumulators keyed by ACP message ID, retaining a stable fallback ID.
- [x] 1.2 Emit independent message completion events without changing provider-neutral protocol or browser ownership boundaries.
- [x] 1.3 Add OpenCode/Qoder shared ACP regressions for message separation, tool interleaving, fallback IDs, completion order, and bounded text.

## 2. Side Panel projection

- [x] 2.1 Add reducer regressions proving a later message remains after intervening activity and does not merge into the earlier bubble.
- [x] 2.2 Preserve existing streaming completion, scroll, history, approval, and activity presentation behavior.

## 3. Verification and compatibility

- [x] 3.1 Run Bridge and Extension scoped tests/typechecks, full workspace checks, OpenSpec validation, and `git diff --check`.
- [x] 3.2 Review `docs/compatibility/opencode-1.18.12.md` and the Qoder compatibility notes; record that message ordering is a normalized ACP capability with no browser ownership impact.
- [x] 3.3 Attempt a real existing-Chrome Side Panel smoke check with a local fixture if the connected provider is available; the current Chrome session exposed no Side Panel target, so no browser mutation or fixture run was performed.
