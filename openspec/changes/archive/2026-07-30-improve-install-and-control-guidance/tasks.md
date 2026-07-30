## 1. Local Integration Settings

- [x] 1.1 Add and validate correlated Native Messaging integration request/response types for reading, setting, and conditionally clearing the user-level default Provider
- [x] 1.2 Factor atomic user-level default configuration into the Bridge package and retain setup CLI behavior through the shared helper
- [x] 1.3 Handle integration settings in the Native Host and update RFC-0001 for the new message family

## 2. Extension Background Behavior

- [x] 2.1 Expose Native Host readiness, default-Provider state, and pending all-tabs authorization in Extension status
- [x] 2.2 Add fail-closed controlled-tab activate and close runtime actions plus Native Host retry
- [x] 2.3 Make `Target.createTarget` authorization failures actionable and add focused background tests

## 3. Side Panel Guidance

- [x] 3.1 Add localized compact Native Host setup/retry and all-tabs authorization guidance
- [x] 3.2 Add settings controls to set or clear the user-level default while preserving setup CLI controls
- [x] 3.3 Show controlled tabs in expanded external-control details with activate and close actions
- [x] 3.4 Recognize known Panerelay Provider/plugin failures and render setup guidance while preserving diagnostics
- [x] 3.5 Add component and controller coverage for the new states and actions

## 4. Documentation and Compatibility

- [x] 4.1 Simplify the English and Chinese README installation command and document optional default selection and recovery without uninstalling
- [x] 4.2 Update agent-browser compatibility documentation for the verified baseline and guidance-only behavior

## 5. Verification and Cleanup

- [x] 5.1 Run package-scoped tests, formatting, full workspace checks, and `git diff --check`
- [x] 5.2 Reload the development Extension, verify the live Native Host and agent-browser tab list/new/close path in the existing Chrome session, and cover settings/readiness actions with focused background and component tests
- [x] 5.3 Reconcile OpenSpec artifacts with implementation findings and mark completed tasks

## 6. Release and UI Follow-ups

- [x] 6.1 Generate beta npm versions with one run-number ordinal while keeping retries idempotent
- [x] 6.2 Rename and simplify the Extension's default-Provider setting copy
- [x] 6.3 Remove the duplicate whole-session release button from external control and update focused tests
- [x] 6.4 Run release, Extension, workspace, OpenSpec, and diff validation
- [x] 6.5 Align the default-Provider row with theme and language using a right-side agent-browser toggle and no secondary description
- [x] 6.6 Run focused Extension tests, workspace checks, OpenSpec validation, and diff validation
- [x] 6.7 Display the internal `panerelay_browser` activity prefix as `panerelay` without changing MCP identifiers
- [x] 6.8 Run focused Extension tests, workspace checks, OpenSpec validation, and diff validation
