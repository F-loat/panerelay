## Why

ACP providers can emit more than one assistant message during a turn. The current shared ACP adapter replaces every live message ID with one turn-level ID, so progress commentary and the later final answer are rendered as one bubble. Because that bubble is inserted when the first text arrives, the final answer can appear above tool activity that happened between the two messages.

## What Changes

- Preserve the ACP-provided assistant message ID for live message events, with a turn-scoped fallback only when ACP omits it.
- Track each assistant message independently and emit one completion event per message.
- Keep the existing chronological event-to-timeline behavior, so a later final message is inserted after intervening tool activity instead of mutating an earlier commentary bubble.
- Add regressions for multiple ACP message IDs, fallback IDs, and the Side Panel timeline reducer.

Non-goals:

- This does not infer message phases from provider text, reorder events emitted by a provider, or change ACP behavior.
- It does not change browser authorization, control ownership, browser automation, approvals, or provider process lifecycle.
- It does not expose raw ACP payloads or add provider-specific OpenCode/Qoder logic.

## Compatibility

- Applies to the shared ACP adapter used by OpenCode 1.18.12 and Qoder ACP integrations.
- The agent-browser 0.33.0, Browser Use 0.13.7 / Browser Harness 0.1.8, and Playwright CLI 0.1.17 compatibility groups are unaffected.
- No browser attachment or browser-level compatibility claim changes.
