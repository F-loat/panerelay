## 1. Extension Behavior

- [x] 1.1 Add a dedicated side-panel release request and route it to lease-wide background cleanup that preserves authorization state
- [x] 1.2 Make selected settings scope buttons toggle to `none` and route the release button through the dedicated controller action

## 2. Automated Coverage

- [x] 2.1 Cover request routing, controller state, segmented-toggle behavior, release preservation, and lease-release boundaries with deterministic Extension tests

## 3. Architecture and Compatibility

- [x] 3.1 Amend RFC-0001 to distinguish scope clearing from control release and update the affected agent-browser 0.33.0 and Browser Use 0.13.7 compatibility notes

## 4. Validation

- [x] 4.1 Run OpenSpec validation, Extension tests/typecheck, the full repository check, and `git diff --check`
- [x] 4.2 Verify both scope toggles and scope-preserving release in an existing daily Chrome settings panel, store any screenshots/logs outside the repository, and clean up verification-only tabs or sessions
