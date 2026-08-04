## 1. Conversation Target Context

- [x] 1.1 Extend and validate `ConversationPageContext` with an optional canonical-UUID browser/target hint while preserving URL/title-only requests and rejecting partial or malformed hints.
- [x] 1.2 Capture the active Extension browser UUID and existing opaque target UUID for a new draft's first send, including target-only context when URL/title is unavailable, with workspace-service and protocol regressions.
- [x] 1.3 Add shared helpers for the reserved `panerelay-tab-v1-<browser-uuid>-<target-uuid>` session value and target-scoped Playwright URL, then render bounded non-authorizing engine guidance inside the existing provider context paths.
- [x] 1.4 Verify Codex, Claude, Qoder, and OpenCode context tests preserve current user text, image ordering, setup hints, and v1 ACP context-envelope privacy while adding target guidance only to new conversations.

## 2. Relay and agent-browser Binding

- [x] 2.1 Add optional validated `initialTargetId` fields to authenticated relay-session and CDP-bootstrap request state without changing ordinary callers or public Chrome tab identity.
- [x] 2.2 Resolve hinted participants only against the selected live browser's current authorized inventory, returning one bounded target-unavailable failure without attachment, authorization, or control side effects.
- [x] 2.3 Order both `Target.getTargets` and initial `Target.targetCreated` publication per hinted participant, revalidate before publication, and release the participant if the target disappears during the allocation/discovery race.
- [x] 2.4 Parse only the reserved agent-browser session format, select its exact browser registration, forward the initial target hint, and preserve every ordinary session name and cleanup path.
- [x] 2.5 Add protocol, Provider-plugin, relay, revocation, stale-browser, unauthorized-target, discovery-order, race, and normal all-tabs/controlled-lineage regression tests.

## 3. Browser Use and Playwright Targeting

- [x] 3.1 Add Browser Use context/Skill regressions proving the injected opaque ID is consumed by unchanged `switch_tab(targetId)` on the shared `panerelay` lane and fails without URL/title fallback or a second daemon.
- [x] 3.2 Add a target-scoped Playwright gateway selection token and parser that binds opaque browser/target UUIDs while retaining existing unscoped and browser-generation-scoped URLs.
- [x] 3.3 Forward Playwright target selections into authenticated bootstrap participants and return bounded gateway failures for stale, wrong-browser, unavailable, or unauthorized targets.
- [x] 3.4 Add Playwright environment, gateway, bootstrap, coexistence, session-name, index-0 ordering, revocation, and backward-compatibility tests without modifying upstream Playwright CLI.

## 4. Architecture, Skill, and Compatibility Records

- [x] 4.1 Amend RFC-0002 with conversation target hints, participant-local initial ordering, non-authority semantics, fail-closed lifecycle, and the reserved agent-browser session binding.
- [x] 4.2 Amend RFC-0007 with Browser Use's direct target helper boundary and Playwright's target-scoped gateway/session flow while preserving the single Browser Harness lane.
- [x] 4.3 Update the independently managed `panerelay-browser` Skill and user-facing integration docs with exact agent-browser, Browser Use, and Playwright commands plus stale-target diagnostics.
- [x] 4.4 Update the agent-browser 0.33.0, Browser Use 0.13.7/Browser Harness 0.1.8, and Playwright CLI 0.1.17 compatibility matrices and retained probe notes without promoting unexecuted behavior to `Verified`.
- [x] 4.5 Make ordinary-task engine selection deterministic and single-candidate across injected context and the unified Skill, with agent-browser as the no-hint recommendation and no all-engine probing or unsolicited choice prompt.

## 5. Verification and Cleanup

- [x] 5.1 Run package-scoped protocol, Extension, agent-browser, browser-use, Playwright, and Bridge tests/typechecks, then `pnpm install --frozen-lockfile`, `pnpm run check`, and `git diff --check`.
- [x] 5.2 In an explicitly authorized daily Chrome fixture, verify agent-browser 0.33.0 maps the injected session target to `t1`, preserves other tab behavior, and fails closed after target revocation; release the exact session and remove fixture artifacts.
- [x] 5.3 In the same bounded fixture, verify Browser Use 0.13.7/Browser Harness 0.1.8 switches by the injected opaque target on its existing shared lane and reports a stale target without spawning another daemon; restore prior lane state and release control.
- [x] 5.4 In the same bounded fixture, verify Playwright CLI 0.1.17 uses the injected `-s` session and target-scoped attach with the intended page at index `0`, then fails closed after revocation; detach the exact session and remove temporary evidence.
- [x] 5.5 Confirm every test participant, control lease, fixture tab, temporary server, and local evidence artifact is released or removed, and record only bounded reproducible results in compatibility documentation.
- [x] 5.6 Add context and Skill regressions for user-named selection, registered-default priority, no-hint agent-browser recommendation, and selected-engine-only stale-hint repair; rerun the affected Bridge checks and `git diff --check`.
