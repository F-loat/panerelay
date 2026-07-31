## 1. Extension Request Lifecycle

- [x] 1.1 Add a typed pending-request tracker with deterministic coverage for success, failure, timeout, synchronous dispatch failure, stale responses, and reject-all cleanup
- [x] 1.2 Replace the background worker's Agent and integration pending maps with isolated tracker instances while preserving protocol-specific response validation and timeout text

## 2. Provider Browser Sessions

- [x] 2.1 Add a Bridge-internal agent-browser session helper with coverage for scoped MCP environment construction, optional browser selection, command resolution, cleanup timeout, and failure propagation
- [x] 2.2 Migrate Codex, Claude, and Qoder MCP configuration, side-panel instructions, and cleanup calls to the shared definition without changing Provider-native payloads or public types
- [x] 2.3 Run focused Extension and Bridge tests and review the diff for unintended protocol, authorization, lease, or routing changes

## 3. Compatibility and Validation

- [x] 3.1 Confirm RFC-0001, RFC-0006, and agent-browser 0.33.0 compatibility classifications remain unchanged and record that no compatibility-document update is required
- [x] 3.2 Run one bounded agent-browser 0.33.0 daily-Chrome session through Panerelay, verify participant cleanup, and remove its temporary tab, process, and browser state
- [x] 3.3 Run frozen installation, formatting, strict lint, typechecks, tests, builds, strict OpenSpec validation, and `git diff --check`

## 4. Browser Relay Responsibilities

- [x] 4.1 Extract CDP target-origin and browser-ownership policy into a pure internal module with direct tests for existing allowed and denied cases
- [x] 4.2 Extract per-target FIFO command scheduling and disconnected-waiter cancellation into a generic internal scheduler with deterministic tests
- [x] 4.3 Extract sanitized control-activity correlation, bounded retention, sequencing, and snapshot construction into an internal journal with deterministic tests
- [x] 4.4 Integrate the extracted modules into `BrowserRelay` while preserving private ownership of participants, leases, transports, target/session maps, attachment state, and teardown ordering

## 5. Extension Background Responsibilities

- [x] 5.1 Add a typed side-panel request router with representative tests for status, provider, workspace, page-comment, conversation, and controlled-tab dispatch
- [x] 5.2 Replace the background worker's UI request switch with the router while retaining authorization, controlled-tab validation, Chrome listeners, Native Messaging, and CDP state in the entry point

## 6. Side Panel and Page-Comment Runtime Responsibilities

- [x] 6.1 Move the Side Panel state model, initial-state factory, reducer, and timeline transition helpers into a pure module without changing existing exports or reducer behavior
- [x] 6.2 Move image count, MIME, per-file size, aggregate size, and base64 preparation into a tested helper while retaining controller generation guards and localized errors
- [x] 6.3 Move serializable page-comment properties, localized labels, icons, and editor CSS into an immutable assets module supplied explicitly through `executeScript.args`
- [x] 6.4 Verify serialized and direct page-comment runtime execution use the same assets and preserve per-frame installation, UI, evidence, edit, and cleanup behavior

## 7. Structural Review and Validation

- [x] 7.1 Review dependency directions, remaining orchestrator responsibilities, source file sizes, and exported surfaces; remove accidental forwarding abstractions or cycles
- [x] 7.2 Run focused Bridge and Extension tests after each extraction and confirm RFC-0001 through RFC-0004 plus RFC-0006 compatibility claims remain unchanged
- [x] 7.3 Run one bounded agent-browser 0.33.0 daily-Chrome regression through Panerelay and clean its tab, participant, process, fixture, and browser state
- [x] 7.4 Run frozen installation, formatting, strict lint, typechecks, all tests, builds, strict OpenSpec validation, and `git diff --check`
