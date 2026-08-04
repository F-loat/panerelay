## 1. Extension Action Menu

- [x] 1.1 Declare the Extension context-menu permission and add English and Simplified Chinese locale messages for the whole-lease release item.
- [x] 1.2 Add focused action-menu registration and click-dispatch plumbing, then wire the matching click to the existing `releaseBrowserControl()` operation with background error reporting.

## 2. Automated Coverage

- [x] 2.1 Add unit coverage for the stable menu identifier, action-only registration, localized title, unrelated-click filtering, and matching-click release dispatch.
- [x] 2.2 Extend Extension build/package contract coverage to verify the permission, localized messages, and action-menu background wiring are present in generated output.

## 3. Verification and Compatibility

- [x] 3.1 Run Extension formatting, typecheck, build, and targeted automated tests.
- [x] 3.2 Verify in a current daily Chrome build that right-clicking the Panerelay icon shows the localized release item and that activating it clears all Panerelay control while preserving the selected authorization scope.
- [x] 3.3 Review the compatibility records and document that no matrix entry or RFC change is required because agent-browser `0.33.0`, protocol behavior, and capability classifications are unchanged.
- [x] 3.4 Run strict OpenSpec validation, the full repository check, and `git diff --check`; remove temporary unpacked builds, screenshots, and browser logs from the repository workspace.
