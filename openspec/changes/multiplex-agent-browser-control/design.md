## Context

See `proposal.md` for motivation. The Bridge currently models one active relay session with one actor and up to four WebSocket transports. A second Provider allocation receives HTTP 409 even though the existing browser-level CDP relay can already route multiple client transports and independent flattened page sessions. RFC-0001, RFC-0002, and RFC-0003 currently describe that exclusivity and must change with the implementation.

agent-browser 0.33.0 remains the minimum and verified baseline. Provider startup, overlapping transports, target discovery, tab management, cleanup, and activity attribution require new automated evidence; the shared-participant path remains `Partial` until a representative daily-Chrome run passes.

## Goals / Non-Goals

**Goals:**

- Let independently named local agent-browser sessions reuse one authorized browser lease without a permission prompt, debugger displacement, or manual release.
- Keep virtual CDP sessions, refs, pending commands, cleanup, heartbeat, and activity attribution isolated per participant.
- Keep Agent target selection and ordinary automation in the background without changing the user's visible Chrome tab or window focus.
- Preserve one-at-a-time command forwarding on each Chrome target.
- Make Provider and Agent failures inspectable without expanding successful activity by default.

**Non-Goals:**

- Provide concurrent browser mutation with unspecified ordering.
- Treat an agent-browser session label as authentication.
- Share element references or agent-browser daemon state between participants.
- Persist raw errors, CDP traffic, or page data as an audit log.

## Decisions

### Model one browser lease with independently authenticated participants

`BrowserRelay` will own one active lease containing a bounded participant map. Every successful `POST /sessions` creates a participant with its own opaque ID, token, actor, allocation deadline, heartbeat timestamps, and transport set. The returned `sessionId` remains the participant cleanup identifier; the lease keeps a separate opaque ID for UI and activity sequencing.

The CDP URL authenticates one participant. A transport cannot select another participant by session label. This reuses the existing user-scoped Bridge bootstrap token only for allocation and preserves random per-participant CDP credentials.

Returning the first participant's credential to every Provider was rejected because one Provider cleanup would revoke everyone and a leaked participant token could not be scoped or expired independently. Reusing a fixed agent-browser `default` session was rejected because it would share daemon refs and state across conversations rather than reuse only the browser relay.

### Join additional participants without detaching Chrome

If a responsive lease exists, a new Provider allocation joins it. Target discovery remains lease-wide, while flattened page sessions remain transport-owned. Chrome debugger attachments are retained while any virtual page session references the target; a participant leaving removes only its sessions and pending work. The last participant ending revokes the lease and detaches every target.

This is reuse, not silent authorization: joining is possible only while the same registered Extension and existing authorization remain authoritative. Extension release or authorization changes still revoke the whole lease.

### Track heartbeat and cleanup per participant

Heartbeat checks evaluate each participant's transports. An expired participant is removed without affecting responsive participants. Allocation expiry removes a participant that never connected. Explicit Provider cleanup closes only that participant. Browser/Extension failure and user authorization release remain lease-wide terminal events.

The Bridge limits both participant count and transport count per participant to prevent a local client from exhausting memory or file descriptors.

### Serialize complete target-scoped command lifecycles

The Bridge keeps a FIFO queue per opaque target. A target-scoped CDP command acquires the queue before it is forwarded and releases it only after its correlated result, error, cancellation, participant cleanup, or timeout. Target create/close/activate operations use the same scheduling boundary where applicable.

Serializing only WebSocket message parsing was rejected because forwarding returns before the Extension result and would still allow overlapping Chrome commands. A single global queue was rejected because a slow command on one authorized tab would unnecessarily block unrelated tabs.

### Virtualize foreground activation

The Bridge will treat `Target.activateTarget` as an Agent-local selection acknowledgement and will not forward a Chrome activation request. The Extension will create permitted targets with `active: false`, and page-scoped `Page.bringToFront` will be handled as a successful no-op. Target discovery, virtual page sessions, and agent-browser's own per-session selected-page state continue to determine where later commands are routed.

This boundary applies to user-visible Chrome tab and window focus. DOM `focus`, keyboard input, mouse input, and other page-scoped commands still execute inside the explicitly selected authorized target because suppressing them would break automation semantics; Chrome debugger can deliver those commands without foreground activation.

Forwarding `Target.activateTarget` or `Page.bringToFront` was rejected because agent-browser uses them for its own tab model, while in a daily browser they visibly interrupt the user. Temporarily activating and restoring the previous tab was also rejected because it still causes flicker, races with user input, and can restore the wrong tab after concurrent human navigation.

### Attribute control status and activity to the issuing participant

Client state carries its authenticated participant ID. Activity records copy that participant's actor. The lease summary exposes participant count and identifies the participant that most recently connected or issued a command as the current actor. Sanitized activity remains one bounded lease-wide stream so the user can understand handoffs without storing raw parameters or results.

### Preserve only provider-approved error text

The Codex adapter reads the documented MCP item `error.message`. The Qoder adapter reads displayable text content only when a tool is failed. Both bound the resulting string before placing it in `ConversationActivity.detail`; successful outputs, raw input/output objects, MCP structured content, and images are excluded.

Failed activity and error UI use native disclosure semantics. The summary stays one line, while the expanded body wraps and remains selectable. Items without additional detail remain ordinary rows.

## Risks / Trade-offs

- [Two Agents intentionally act on one tab] → Serialize full target command lifecycles and keep participant-specific virtual sessions; browser state can still change between commands and remains visible to both Agents.
- [A participant never returns a CDP result] → Apply the existing bounded Extension timeout, release the target queue on every terminal cleanup path, and cover it with deterministic tests.
- [One daemon opens overlapping transports] → Count transports inside its participant and preserve current overlap compatibility without misreporting them as separate Agents.
- [Activity actor changes frequently] → Treat the summary actor as current activity, expose participant count, and retain participant-attributed bounded rows.
- [Upstream Agent schemas change] → Keep error extraction isolated, bounded, and covered by fixtures; omit detail when the documented field is unavailable.
- [Shared relay regresses agent-browser 0.33.0] → Keep the existing exclusive-path contract tests, add two-participant tests, and run a daily-Chrome overlap scenario before claiming `Verified`.
- [Upstream expects browser activation before background commands] → Cover snapshot, read, interaction, navigation, create, select, and close against background targets; fail an unsupported command explicitly rather than foregrounding Chrome.

## Migration Plan

1. Land protocol, Bridge, Provider, Extension, RFC, and compatibility changes in one lockstep release.
2. Existing Providers continue calling the same allocation and cleanup endpoints; only the former HTTP 409 path becomes a successful additional participant.
3. Reload the Extension and restart the Native Host before real-browser verification so stale single-session state cannot cross the new model.
4. Rollback restores exclusive allocation. Any joined participants are disconnected by the older Bridge restart and must reconnect normally.
