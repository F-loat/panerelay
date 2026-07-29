## Why

PaneRelay can now control authorized daily-Chrome targets through agent-browser, but an active external Agent is visible only as a debugger badge and an exclusive lease. The product needs a bounded, privacy-preserving control-session lifecycle and activity stream so users can tell who is controlling which target, what category of work is in progress, and whether control has expired or been released.

## What Changes

- Add heartbeat-backed lease liveness after the Provider's short connection window, with bounded expiry and deterministic release when every authenticated CDP transport becomes unresponsive.
- Publish provider-neutral control-session status containing the automation actor, lifecycle state, expiry, and controlled target count.
- Normalize CDP commands into coarse activity categories and emit started/completed/failed events without raw command parameters, page data, URLs, cookies, headers, prompts, or response bodies.
- Keep a bounded activity view in the Extension and display external-agent status and recent activity in the side panel.
- Report activity-history resets or gaps explicitly after Bridge or Extension reconnection.
- Preserve immediate user release, exclusive mutation ownership, lazy target attachment, and agent-browser 0.33.0 compatibility.

Non-goals:

- No control handoff between agents or conversations in this change.
- No shared read-only lease, multi-agent mutation, cloud replay, durable audit database, raw CDP journal, or browser-process ownership.
- No capture of screenshots, page content, selected elements, request data, cookies, credentials, prompts, or command arguments in activity events.

## Capabilities

### New Capabilities

- `control-session-lifecycle`: Defines authenticated lease connection, heartbeat, expiry, release, and reconnect behavior.
- `external-agent-activity`: Defines the sanitized, bounded activity stream and its side-panel presentation.

### Modified Capabilities

None.

## Impact

- Protocol: new control-session and automation-activity messages shared by the Bridge and Extension.
- Bridge: WebSocket heartbeat scheduling, active-lease expiry, activity classification, and bounded event sequencing.
- Extension: background status/activity storage, replay-gap signaling, and side-panel rendering.
- Tests: protocol guards, Bridge fake-timer/transport tests, Extension rendering/state tests, and an agent-browser 0.33.0 daily-Chrome acceptance run.
- Architecture: governed by draft RFC-0003; RFC-0001 and RFC-0002 authorization and browser-ownership boundaries remain unchanged.
