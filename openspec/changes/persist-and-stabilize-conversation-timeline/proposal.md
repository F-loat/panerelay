## Why

Closing and reopening the Side Panel currently discards the Extension's normalized timeline, while provider resume may return only messages or no history at all. This loses reasoning and activity cards, and the current active-reasoning presentation also makes one card repeatedly disappear and reappear as a turn alternates between thought, tool, and message output.

## What Changes

- Persist a bounded, versioned, conversation-scoped snapshot of the user-visible normalized timeline in `chrome.storage.session` while the Side Panel is open and while normalized conversation events continue in the Extension background.
- Restore the session snapshot before provider resume and keep that retained timeline authoritative for the current Chrome session; use provider messages only when no local timeline exists.
- Preserve visible user and assistant text plus semantic reasoning, activity, terminal error, and non-actionable approval history needed for diagnosis, while excluding raw ACP/CDP payloads, page snapshots, images, credentials, prompts injected by Panerelay, and unbounded tool output.
- Give distinct reasoning segments stable identities and render one segment continuously instead of moving it between transient feedback and timeline cards as adjacent event kinds arrive.
- Show the active reasoning segment as a bounded multi-line live preview, collapse it when it stops being active, and keep completed reasoning manually expandable.
- Segment one provider message around intervening visible cards so later final output remains after the tool or reasoning that preceded it.
- Keep the live progress indicator on at most the latest active message card and show the trailing, rather than leading, lines of active reasoning.
- Keep message-copy controls overlaid in the card corner and reveal them only for card hover, keyboard focus, status feedback, or non-hover input.
- Include the current browser tab, authorization tab, controlled tabs, and content-free control activity metadata in explicitly copied conversation diagnostics so tab/workspace confusion can be reproduced.
- Expire restored approval requests so a snapshot can never recreate an actionable permission decision.
- Document the Extension-private session storage and retention boundary in the accepted architecture record.
- Non-goals: durable history across a Chrome restart, replacing provider-owned conversation history, replaying raw provider events, persisting browser page content, or changing browser authorization, target ownership, focus, or control-lease behavior.
- Browser ownership limitation: restoring a conversation timeline grants no site permission, tab authorization, target attachment, or control lease.

## Capabilities

### New Capabilities

- `conversation-timeline-continuity`: Defines bounded session-local persistence, background continuation, safe restore/provider fallback, and stable live reasoning-card behavior for normalized Side Panel timelines.

### Modified Capabilities

None.

## Impact

- Affects Extension background storage/message handling and Side Panel timeline state, rendering, restore, and tests.
- Adds an Extension-private versioned storage schema and bounded normalized event projection; no shared Agent protocol or provider-native schema changes are required.
- Updates the relevant accepted RFC to record content classification, lifetime, and authority invariants.
- The pinned `agent-browser` compatibility baseline remains `0.33.0`; agent-browser, Playwright, Browser Use, CDP routing, and their compatibility groups are not behaviorally affected.
