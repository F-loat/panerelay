## 1. Protocol and classification

- [x] 1.1 Add provider-neutral control-session summaries, sanitized activity records, snapshots, updates, and runtime guards to `@panerelay/protocol`
- [x] 1.2 Add a closed CDP-method classifier whose output contains stable categories and localization keys but no raw method, params, result, or page data
- [x] 1.3 Cover protocol guards and sensitive-value exclusion with automated tests

## 2. Control-session liveness

- [x] 2.1 Track authenticated WebSocket connection, command, ping, and pong freshness with configurable test intervals and production defaults
- [x] 2.2 Keep a lease live while any authenticated transport is responsive, and expire it when every transport exceeds the heartbeat deadline
- [x] 2.3 On expiry or release, close transports, fail pending commands, detach controlled targets, and prevent stale credentials from reviving the session
- [x] 2.4 Add Bridge tests for allocation expiry, active heartbeat renewal, multiple transports, pending-command races, user release, and stale reconnects

## 3. Bounded external activity

- [x] 3.1 Emit session lifecycle summaries on allocation, connection, target-count changes, heartbeat freshness, and terminal transitions
- [x] 3.2 Correlate routed commands with started and completed, failed, or denied sanitized activity updates
- [x] 3.3 Retain bounded in-memory activity with one process epoch and increasing sequence numbers, and replay a snapshot after Extension registration
- [x] 3.4 Add automated tests for correlation, policy denial, bounded retention, sequencing, reconnect snapshots, and absence of sensitive values

## 4. Extension and side panel

- [x] 4.1 Handle control-session and activity messages in the Extension without persisting history, renewing leases, or widening browser authorization
- [x] 4.2 Detect epoch and sequence discontinuities and expose an explicit activity-history gap
- [x] 4.3 Add a compact external-control section showing actor, lifecycle, controlled-target count, recent localized activity, freshness, and immediate release
- [x] 4.4 Add Chinese and English copy, light and dark styling, and component/state tests for the new section

## 5. Verification and documentation

- [x] 5.1 Run focused tests and typechecks for protocol, Bridge, and Extension, then run `pnpm run check` and `git diff --check`
- [x] 5.2 Rebuild and reinstall the Native Host, reload the unpacked Extension, and verify heartbeat, activity, and release in the user's daily Chrome with agent-browser 0.33.0
- [x] 5.3 Record the verified behavior and remaining gaps in RFC-0003 and the agent-browser compatibility documentation
- [x] 5.4 Remove test fixtures and temporary browser state, then sync and archive the completed OpenSpec change
