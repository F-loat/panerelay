## 1. Shared Protocol

- [x] 1.1 Add participant count and shared-lease validation to control-session protocol types and tests
- [x] 1.2 Keep Provider allocation and cleanup wire compatibility while documenting participant-scoped session IDs

## 2. Bridge Participant Lifecycle

- [x] 2.1 Replace the single active relay session with a bounded shared lease and independently authenticated participant records
- [x] 2.2 Track WebSocket connection, heartbeat, allocation expiry, and explicit cleanup per participant
- [x] 2.3 Preserve responsive participants and referenced target attachments when another participant ends
- [x] 2.4 Attribute lease status and sanitized activity to the participant that most recently issued a command

## 3. CDP Isolation and Scheduling

- [x] 3.1 Keep virtual page sessions, pending commands, and result delivery isolated by authenticated participant
- [x] 3.2 Serialize complete target-scoped command lifecycles and release queues on result, failure, timeout, or participant cleanup
- [x] 3.3 Add Bridge contract tests for two participants, overlapping transports, independent cleanup, heartbeat expiry, stale credentials, target reuse, and queued command cancellation

## 4. Expandable Agent Errors

- [x] 4.1 Preserve bounded Codex MCP and Qoder failed-tool diagnostic text without forwarding successful or raw tool output
- [x] 4.2 Render failed activity, timeline errors, and global errors collapsed by default with accessible expandable full details
- [x] 4.3 Add provider and Extension component tests for bounded error extraction, collapsed state, expansion, wrapping, and non-expandable failures without detail
- [x] 4.4 Show current reasoning in the working feedback card with generic fallback and timeline preservation

## 5. Architecture and Compatibility

- [x] 5.1 Update RFC-0001, RFC-0002, and RFC-0003 for shared leases, participant ownership, command serialization, and revocation
- [x] 5.2 Update the agent-browser 0.33.0 compatibility matrix with automated and real-browser participant-reuse evidence

## 6. Verification

- [x] 6.1 Run protocol, Bridge, Provider, and Extension focused tests plus formatting and OpenSpec strict validation
- [x] 6.2 Reconnect the Extension to the installed Native Host and verify two independently named agent-browser sessions can list and read the authorized browser without release or reauthorization
- [x] 6.3 Verify participant-specific close, final lease cleanup, controlled-tab visibility, and expandable Agent failure detail
- [x] 6.4 Run `pnpm run check` and `git diff --check`

## 7. Background Target Control

- [x] 7.1 Virtualize `Target.activateTarget` and `Page.bringToFront` without changing Chrome's visible active tab or window focus
- [x] 7.2 Create permitted Agent tabs in the background and preserve participant-local target selection and cleanup semantics
- [x] 7.3 Add Bridge and Extension tests covering select, create, close, and page commands without foreground activation
- [x] 7.4 Update RFC-0002 and the agent-browser compatibility matrix with the background-control boundary and evidence
- [x] 7.5 Verify the behavior in the reloaded daily Chrome profile, then run OpenSpec strict validation, `pnpm run check`, and `git diff --check`
