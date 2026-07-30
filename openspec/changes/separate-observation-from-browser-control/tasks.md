## 1. Shared semantics

- [x] 1.1 Add a fail-closed shared CDP observation/control classifier with focused protocol tests
- [x] 1.2 Extend control-session summaries with a validated observed-target count

## 2. Bridge lifecycle

- [x] 2.1 Replace deferred page/runtime/network enable replay with immediate observation attachment
- [x] 2.2 Track debugger attachments and controlled targets independently across command, detach, participant, and lease cleanup paths
- [x] 2.3 Cover agent-browser bootstrap, retained Network events, first control upgrade, monotonic control, and cleanup in Bridge tests

## 3. Extension presentation

- [x] 3.1 Split attached-tab routing from controlled-tab badge, list, and favicon state
- [x] 3.2 Apply the controlled favicon only for control-class commands and preserve restoration behavior
- [x] 3.3 Deduplicate unchanged target metadata updates
- [x] 3.4 Show localized observed and controlled totals separately in the side panel
- [x] 3.5 Add Extension tests for observation routing, badge/favicon neutrality, control upgrades, metadata deduplication, and side-panel copy

## 4. Documentation and verification

- [x] 4.1 Add the superseding observation/control RFC, link RFC-0002, update RFC-0003, and revise the agent-browser 0.33.0 compatibility matrix
- [x] 4.2 Run package-scoped tests and typechecks, `pnpm run check`, strict OpenSpec validation, and `git diff --check`
- [x] 4.3 Verify in daily Chrome that a newly discovered tab retains Network history without changing controlled count/favicon, then upgrades exactly once on a control-class command
- [x] 4.4 Remove temporary browser state and record reproducible verification evidence

## 5. Controlled-lineage target discovery

- [x] 5.1 Seed the discovery lease once and keep later target-list responses restricted to its exposed inventory
- [x] 5.2 Expose Agent-created tabs and tabs opened from a currently controlled source through trusted Chrome opener/navigation-target relationships
- [x] 5.3 Keep independently opened and observed-source tabs out of lifecycle events, target lists, debugger attachment, and counts
- [x] 5.4 Serialize lifecycle publication per tab and emit exactly one created event across concurrent Chrome creation and update events
- [x] 5.5 Add focused Extension and Bridge regressions for initial seeding, controlled lineage, ordinary-tab suppression, relisting, duplicate-created prevention, and cleanup

## 6. Documentation and browser verification

- [x] 6.1 Update the accepted browser-control RFCs and agent-browser 0.33.0 compatibility evidence with bounded discovery expansion
- [x] 6.2 Verify in daily Chrome that an ordinary new tab stays absent while a controlled-source tab and an Agent-created tab are discovered exactly once
- [x] 6.3 Run package-scoped checks, `pnpm run check`, strict OpenSpec validation, frozen install, and `git diff --check`
- [x] 6.4 Remove every temporary tab, Agent participant, and fixture resource used by verification
