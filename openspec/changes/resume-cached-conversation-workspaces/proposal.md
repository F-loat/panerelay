## Why

The Extension already retains bounded conversation summaries and timelines for the current Chrome session, but the Side Panel history picker exposes only provider-listed sessions. Qoder installations that cannot list sessions therefore hide conversations Panerelay can safely restore, and selecting a listed conversation replaces the current workspace payload instead of joining the conversation's existing related-tab group.

## What Changes

- Merge the selected provider's Extension-retained conversation summaries into the on-demand history picker, deduplicated with provider history and ordered by recent activity.
- Keep retained history usable when provider session listing is unsupported or fails, while preserving a retryable provider error when no retained conversation can satisfy the request.
- Resume an explicitly selected retained conversation through the existing provider capability before changing workspace state.
- After a successful resume, move only the active tab into the selected conversation's existing Extension-private related-tab group; create a new group for that conversation when no live group remains.
- Restore the joined workspace and retained timeline automatically when the Side Panel is recreated for that tab during the same Chrome session.
- Keep provider-returned metadata authoritative for a matching history item when it is available; retained summaries are a bounded local fallback.
- Non-goals: inventing provider sessions, bypassing provider resume/load capability, persisting conversation content across a Chrome restart, changing Chrome tab groups, automatically binding tabs based on focus or matching URLs, or changing browser authorization, debugger attachment, target selection, control leases, or approval authority.
- Browser ownership limitation: a cached summary, successful resume, or workspace-group join grants no site permission, tab authorization, debugger attachment, target ownership, focus, or browser-control lease.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-history-workflow`: The on-demand history picker includes Extension-retained conversations and remains useful when provider listing is unavailable.
- `tab-conversation-workspaces`: Selecting a resumable conversation moves only the active tab into that conversation's existing related-tab workspace group and restores that binding after Side Panel recreation.

## Impact

- Affects Extension-private timeline listing, Side Panel request routing, conversation workspace storage/service behavior, and history/controller tests under `apps/extension`.
- Updates RFC-0001's Extension-private workspace description and Qoder compatibility evidence; no shared protocol shape or provider-native payload changes.
- Qoder compatibility is affected because cached summaries cover its missing or failed ACP session-list behavior. Codex, Claude Code, and OpenCode continue to prefer provider history when available.
- The pinned agent-browser 0.33.0, Browser Use, Playwright CLI, browser authorization, target ownership, and control-lease behavior are unchanged.
- Adds no dependency and retains no new content class; the existing bounded `chrome.storage.session` timeline lifetime remains authoritative.
