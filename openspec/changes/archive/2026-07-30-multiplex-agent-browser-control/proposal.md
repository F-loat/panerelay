## Why

Panerelay currently rejects a new agent-browser Provider session while another local Agent keeps a responsive relay session open. This makes side-panel Agents fail even though the browser is authorized and already connected, and exposes only a generic plugin error instead of a useful explanation.

## What Changes

- Replace the single-participant relay session with one browser control lease that can host multiple authenticated local agent-browser participants.
- Give each participant independent credentials, transports, virtual CDP sessions, element references, heartbeat state, cleanup, and activity attribution while reusing eligible targets and Chrome debugger attachments.
- Serialize target-scoped CDP forwarding so two participants cannot mutate one target concurrently.
- Keep each participant's selected target logical to that Agent so tab selection and ordinary automation do not steal the user's visible Chrome tab or window focus.
- Release one participant without disconnecting the remaining participants; detach browser targets only when no participant still references them or the user revokes authorization.
- Keep the active participant visible in the side panel and preserve bounded, sanitized activity history for all participants.
- Preserve failure details from Agent providers and let users expand failed activity and error cards on demand.
- Update RFC-0001, RFC-0002, and RFC-0003 to record the shared-lease ownership model.

### Non-goals and browser-ownership limits

- Do not share agent-browser element references, page-session IDs, pending commands, or restore state between participants.
- Do not allow unauthenticated processes, remote clients, or a different Chrome Extension installation to join a lease.
- Do not widen Chrome site permissions, authorize tabs, or keep a participant alive without its own authenticated transport.
- Do not treat Agent target selection, `Target.activateTarget`, `Page.bringToFront`, or target creation as permission to change the user's visible Chrome focus.
- Do not record raw CDP params/results, page content, URLs, cookies, credentials, prompts, screenshots, or request bodies in activity or error diagnostics.
- Do not add isolated browser contexts, launch flags, profile control, `Browser.close`, or other process-ownership capabilities excluded by RFC-0002.
- Do not claim newer agent-browser versions are verified merely because they satisfy the minimum version floor.

## Capabilities

### New Capabilities

- `agent-error-details`: Covers bounded error-detail preservation and collapsed, user-expandable failure presentation in the side panel.

### Modified Capabilities

- `control-session-lifecycle`: A browser control lease can contain multiple independently authenticated agent-browser participants and remains live until every participant ends or authorization is revoked.
- `external-agent-activity`: Activity remains sanitized but is attributed to the participant that issued each command, and the visible actor follows current activity without hiding other participants.

## Impact

- Bridge relay allocation, credential validation, WebSocket routing, heartbeat, participant cleanup, target attachment reuse, and command scheduling.
- `@panerelay/protocol` control-session and relay-session types plus validation.
- Panerelay agent-browser Provider cleanup metadata and error propagation.
- Extension control-status and conversation activity presentation, localization, and component tests.
- RFC-0001, RFC-0002, RFC-0003, and the agent-browser 0.33.0 compatibility matrix.
