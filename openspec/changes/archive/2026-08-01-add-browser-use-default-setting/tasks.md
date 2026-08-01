## 1. Integration Contract and Bridge

- [x] 1.1 Add bounded Browser Use default get/set/clear protocol operations and contract tests.
- [x] 1.2 Make the Bridge validate the Browser Use adapter registration and read/write its existing Direct/Extension preference through the CLI public API.
- [x] 1.3 Add Bridge tests for available, missing, set, clear, independent agent-browser state, and correlated failure cases.
- [x] 1.4 Extend browser-default results with bounded multiple-live-browser state sourced from the existing protected registry, with protocol and Bridge tests.

## 2. Extension State and Routing

- [x] 2.1 Carry Browser Use default state through Extension status, Native Host refresh/disconnect handling, and side-panel request routing.
- [x] 2.2 Add an independent side-panel controller action and pending state with background/router/controller tests.
- [x] 2.3 Carry the multiple-browser visibility state through existing Extension refresh and disconnect paths without adding authorization or control state.

## 3. Settings UI

- [x] 3.1 Replace the Default Provider row with a localized Set as default row containing independent agent-browser and Browser Use buttons.
- [x] 3.2 Remove trailing indicators from the two automation buttons, make them compact, and cover selected, unavailable, and independent-toggle behavior with component tests.
- [x] 3.3 Rename Default Browser to Control by default / 默认受控, replace the browser-name button and decorative indicator with a standard switch, hide the row for zero or one live browser connection, and add component tests.
- [x] 3.4 Keep the compact main-panel browser-authorization card visible for a connected Bridge when the selected Agent is unavailable, while retaining Agent setup guidance and disabled conversation actions, with component coverage.

## 4. Durable Documentation

- [x] 4.1 Amend RFC-0001 and RFC-0007 to record the authenticated Extension settings path and its non-authorizing default semantics.
- [x] 4.2 Confirm the agent-browser 0.33.0 and Browser Use 0.13.7 compatibility evidence remains scoped and unchanged.
- [x] 4.3 Amend RFC-0001 and RFC-0006 with the bounded multiple-browser visibility result and non-authorizing Control by default switch semantics.
- [x] 4.4 Clarify in RFC-0001 that selected-Agent readiness gates conversation operations but not the explicit browser-authorization surface.

## 5. Verification

- [x] 5.1 Run focused protocol, Bridge, and Extension tests, strict OpenSpec validation, the full workspace check, and `git diff --check`.
- [x] 5.2 Verify the compact two-button settings row and both persisted defaults in a daily Chrome Extension run, including Browser Use unavailable state and Native Host reconnect refresh.

  User-confirmed in daily Chrome after reloading the unpacked Extension on 2026-08-01.
- [x] 5.3 Run the focused Extension component tests, strict OpenSpec validation, the full workspace check, and `git diff --check` after decoupling browser authorization from Agent readiness.
