## 1. Browser registration and session policy

- [x] 1.1 Add optional browser-family and CDP-relay capability fields to protocol registration and Bridge state with compatibility tests
- [x] 1.2 Detect Chrome, Chromium, and Edge in the shared Chromium Extension runtime and register the feature-detected CDP capability
- [x] 1.3 Reject explicitly unsupported CDP registrations before participant or lease allocation in the Bridge and agent-browser adapter, with fail-closed tests

## 2. Edge Native Messaging integration

- [x] 2.1 Add Microsoft Edge stable and prerelease per-user manifest paths on macOS and Linux with installation tests
- [x] 2.2 Add exact Microsoft Edge HKCU Native Messaging registration, update, and uninstall behavior on Windows with lifecycle tests
- [x] 2.3 Report Chrome and Edge Windows registry agreement independently in doctor and localized setup output

## 3. Documentation and durable decisions

- [x] 3.1 Add RFC-0005 for Edge browser capabilities, shared Chromium hosting, and Native Messaging ownership
- [x] 3.2 Add an Edge compatibility matrix that distinguishes `Forwarded` and `Unsupported` groups and keeps agent-browser 0.33.0 pinned
- [x] 3.3 Update English and Chinese README, package guidance, setup Skill, and release guidance for Chrome/Edge without adding Firefox artifacts

## 4. Verification and cleanup

- [x] 4.1 Run focused protocol, Extension, Bridge, agent-browser, setup, lifecycle, and release tests
- [x] 4.2 Build and inspect the shared Chromium Extension artifact and verify no Firefox, Gecko, WebDriver, or launcher code is present
- [x] 4.3 Attempt a real existing-browser regression; when current-branch reload is not authorized, record the limitation and keep Edge `Forwarded` until a real Edge run is recorded
- [x] 4.4 Run `pnpm install --frozen-lockfile`, full `pnpm run check`, strict OpenSpec validation, release validation, and `git diff --check`
