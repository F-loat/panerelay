## Context

See `proposal.md` for motivation, the two delta specs for observable behavior, and draft RFC-0003 for the durable liveness, privacy, and product decisions.

The Bridge currently has one `ActiveRelaySession`, a short connection credential window, up to four WebSocket clients, virtual page sessions, and command correlation. It revokes the lease when every WebSocket closes, but a half-open transport has no active liveness deadline. The Extension already maintains browser authorization and controlled-target state and can broadcast status to the side panel.

## Goals / Non-Goals

**Goals:**

- Add transport liveness without changing agent-browser 0.33.0 or its Provider contract.
- Make control status and command lifecycle observable through provider-neutral, privacy-safe protocol data.
- Reuse debugger detach as the cleanup boundary for Fetch, Network, Emulation, trace, and other target-scoped state.
- Keep event retention bounded and memory-only.

**Non-Goals:**

- Do not add a raw operation log, a durable database, a second automation API, or per-command approval.
- Do not merge external automation activity with Codex conversation activity in the protocol.
- Do not implement handoff, shared observation, or multiple mutation owners.

## Decisions

### Use WebSocket ping/pong for heartbeat

The Bridge will periodically send ping frames and record connection, authenticated command, and pong timestamps per transport. The `ws` client responds automatically, so unmodified agent-browser remains compatible.

An active session stays live while at least one transport is responsive. Tests receive configurable heartbeat intervals and deadlines through `BrowserRelayOptions`; production uses fixed internal defaults. Application-level heartbeat commands were rejected because they would require upstream changes or a PaneRelay-specific daemon.

### Keep allocation expiry and lease expiry separate

`connectExpiresAt` continues to bound unused credentials. After the first transport connects, the session receives a rolling heartbeat deadline. Reusing `connectExpiresAt` would incorrectly kill valid sessions shortly after a successful connection.

The session state is calculated from allocation, transport responsiveness, attached-target count, pending commands, and terminal reason. Terminal state is emitted before internal state is discarded, and credentials never revive it.

### Emit status and activity over Native Messaging

The protocol adds host-to-Extension `control.session.changed`, `control.activity.snapshot`, and `control.activity.updated` messages. The Extension never connects directly to the loopback server.

The Bridge emits a session snapshot on allocation, first connection, target-count changes, heartbeat freshness changes at coarse boundaries, and terminal state. It sends the latest activity snapshot when the browser registers or reconnects.

### Classify with a closed label map

A pure classifier maps CDP method prefixes and selected methods to a stable category and localization key. Activity records contain the category and key, never the raw CDP method.

The in-flight command entry stores the activity ID alongside the CDP ID and virtual session ID. Policy rejections create a denied terminal record; Extension results create completed or failed updates. Raw params and results never enter the activity data structure, which avoids relying on incomplete redaction.

### Use epoch and sequence for bounded replay

Each Bridge process creates one random activity epoch. A monotonic sequence increments for session and activity changes. The Bridge retains at most 100 activity records; the Extension retains at most 50 for presentation.

The Extension marks a gap when the epoch changes after it observed activity, when an update skips a sequence, or when a snapshot declares an earlier retained sequence than it can provide. It does not persist the activity timeline in `chrome.storage`.

### Keep side-panel state separate from conversation timelines

External automation appears in a compact control section inside the browser-access settings panel. This keeps the chat surface focused on Codex conversation content while making actor ownership, recent activity, and immediate release available beside the authorization controls. The section reuses the current release action and adds no authorization controls.

## Risks / Trade-offs

- **Background throttling delays heartbeat timers** → Use a deadline substantially larger than the interval and treat any responsive transport as sufficient.
- **A transport responds to pong while its Agent is logically stuck** → Heartbeat proves transport liveness only; the UI presents it as connectivity, not successful work.
- **High command volume floods the panel** → Coalesce updates by activity ID and cap Bridge and Extension buffers.
- **Error messages leak remote data** → Emit only stable PaneRelay policy text or coarse failure labels; never forward arbitrary CDP error data into activity.
- **Extension reconnect loses history** → Epoch/sequence gaps are visible, and terminal lease cleanup remains independent of rendering.
- **Protocol changes require matching pre-alpha builds** → Build protocol, Bridge, and Extension together; do not claim backward compatibility before publication.

## Migration Plan

1. Add protocol types, guards, and classifier tests without changing runtime behavior.
2. Add Bridge heartbeat and lifecycle tests behind configurable test timing.
3. Emit control status and bounded activity snapshots.
4. Add Extension state handling and side-panel presentation.
5. Rebuild and reinstall the Native Host, reload the unpacked Extension, and run the local fixture through agent-browser 0.33.0.
6. Roll back by removing the new messages and heartbeat timer; existing disconnect and user-release behavior remains the fallback.
