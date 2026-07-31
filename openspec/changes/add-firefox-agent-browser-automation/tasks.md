## 1. Architecture and protocol

- [x] 1.1 Add RFC-0006 for browser-specific Extension graphs and the Firefox WebDriver transport, explicitly superseding the affected RFC-0005 decisions
- [x] 1.2 Replace the CDP-only registration gate with a backward-compatible normalized automation transport and protocol tests
- [x] 1.3 Extend Bridge state and relay-session results with transport-specific, opaque connection metadata without exposing driver or Extension tab identities

## 2. Browser-specific Extension graphs

- [x] 2.1 Extract browser-neutral Native Host, Agent, authorization, workspace, and page-comment bootstrap services from the current background entry
- [x] 2.2 Add a Chromium-only background entry and adapters for debugger/CDP, target lifecycle, side panel, badge, and controlled favicon
- [x] 2.3 Add a Firefox-only background entry and adapters for sidebar, readiness, authorization, and WebDriver rendezvous
- [x] 2.4 Split browser-specific panel settings through build-time platform entries while retaining the shared conversation UI
- [x] 2.5 Emit and validate module-ownership evidence proving that neither Extension archive contains the other platform's private adapters
- [x] 2.6 Run existing Chromium and Firefox collaboration suites against the split entries with no behavior regression

## 3. agent-browser WebDriver Provider contract

- [x] 3.1 Create a reproducible patch and contract fixture against agent-browser `v0.33.0` that adds backward-compatible WebDriver Provider results
- [x] 3.2 Validate the patched automation engine selects its existing WebDriver backend, preserves CDP Provider behavior, applies unsupported-action gates, and invokes Provider cleanup
- [x] 3.3 Add a bounded agent-browser capability probe and targeted Firefox upgrade guidance without changing the Chromium `0.33.0` minimum

## 4. Managed Firefox launcher and driver readiness

- [x] 4.1 Add Firefox executable, profile, and geckodriver discovery with validated runtime configuration and version probes
- [x] 4.2 Install per-user macOS, Linux, and Windows Firefox launchers that enable only Marionette and reject unsafe or conflicting arguments
- [x] 4.3 Add managed-process correlation, geckodriver `--connect-existing` startup, health checks, idempotent cleanup, and no implicit Firefox termination
- [x] 4.4 Extend setup, update, uninstall, doctor, localization, and lifecycle tests for launcher and driver readiness

## 5. Firefox WebDriver policy relay

- [x] 5.1 Add participant-scoped virtual WebDriver sessions backed by an unexposed real geckodriver session
- [x] 5.2 Implement exact-route forwarding, virtual/real session rewriting, bounded responses, sanitized activity, and unsupported-route rejection
- [ ] 5.3 Filter window enumeration and enforce mapped-window selection, close, and creation policies including all-tabs escalation
- [x] 5.4 Serialize target work and cover heartbeat, participant close, driver exit, Extension disconnect, Bridge shutdown, and independent participant cleanup

## 6. Authorized Firefox window rendezvous

- [x] 6.1 Add the Firefox-only rendezvous content script and one-time WebDriver challenge flow
- [x] 6.2 Accept mappings only from current top-document browser-attested tab identities with current site permission and explicit automation authorization
- [x] 6.3 Fail closed for missing, duplicate, stale, unauthorized, navigated, or revoked mappings and add adversarial tests
- [x] 6.4 Enable Firefox current-tab/all-tabs authorization and visible release UI only when the complete WebDriver transport is ready

## 7. Compatibility, packaging, and documentation

- [x] 7.1 Update English and Chinese setup, launcher, authorization, restart, rollback, and unsupported-command guidance
- [x] 7.2 Replace the Firefox Unsupported matrix with evidence-based WebDriver command groups while retaining CDP-only limitations
- [x] 7.3 Update release inventory, archive inspection, checksums, workflows, and stable gates for platform graph evidence and Firefox runtime acceptance
- [x] 7.4 Record the coordinated agent-browser commit during development and set a semantic Firefox minimum only after a compatible release exists

## 8. Verification and cleanup

- [x] 8.1 Run frozen installation, package-scoped tests, both isolated Extension builds, full `pnpm run check`, OpenSpec strict validation, release candidate validation, and `git diff --check`
- [ ] 8.2 Repeat the real daily-Chrome regression suite to prove the Chromium split did not change authorization, target, control, or cleanup behavior
- [ ] 8.3 When Firefox and geckodriver are available, run bounded launcher, mapping, navigation, snapshot, input, tabs, screenshot, revocation, and cleanup acceptance without retaining machine output
- [x] 8.4 Review the final diff for platform-code leakage, generated artifacts, credentials, logs, page data, unsupported claims, and unrelated changes
