## Why

Panerelay's Extension-backed CDP relay already depends on Chromium APIs that Microsoft Edge implements, but the current runtime identity, Native Messaging installation, setup diagnostics, and compatibility guidance are Chrome-only. Edge users therefore cannot complete a supported installation even though the existing automation architecture can serve them without a new automation engine.

## What Changes

- Detect Microsoft Edge at Extension runtime and register it explicitly while continuing to use the existing Chromium debugger/CDP implementation.
- Declare browser-family and CDP-relay capability metadata in the Extension registration, with backward-compatible handling for older Chrome registrations and fail-closed handling for an explicit unsupported capability.
- Install and diagnose the Native Messaging host for Microsoft Edge on macOS, Linux, and Windows in addition to Chrome.
- Document one Chromium Extension artifact for Chrome and Edge, Store-first installation through the Chrome Web Store where Edge permits it, and unpacked Edge development setup.
- Add Edge-specific compatibility and real-browser acceptance guidance without claiming evidence that has not been collected.
- Record the durable Edge capability and Native Messaging decisions in RFC-0005.

Non-goals:

- Add Firefox, WebDriver, Gecko-specific manifests, browser launchers, or a Panerelay-owned automation engine.
- Maintain separate Chrome and Edge Extension source graphs or release archives while both use the same Chromium APIs and manifest.
- Publish to Microsoft Edge Add-ons as part of this change.
- Change agent-browser's automation semantics, fork agent-browser, or change the pinned verified agent-browser 0.33.0 baseline.
- Make a daily Edge process behave like a disposable browser process owned by agent-browser.

## Capabilities

### New Capabilities

- `edge-browser-support`: Edge runtime identity, browser capability registration, Chromium/CDP parity, authorization, revocation, and non-Windows Native Messaging installation behavior.

### Modified Capabilities

- `guided-browser-readiness`: Native Host recovery guidance and doctor output cover both Chrome and Edge integrations.
- `stable-distribution`: Stable documentation and acceptance gates include Edge while retaining one Chromium Extension artifact and the pinned agent-browser 0.33.0 compatibility groups.
- `windows-native-messaging`: Windows setup, doctor, update, and uninstall manage both Chrome and Edge current-user Native Messaging registrations.

## Impact

- Affects `apps/extension`, `packages/protocol`, `packages/bridge`, `packages/agent-browser`, `packages/setup`, release validation, README guidance, compatibility documentation, and RFCs.
- Extends the existing registration payload compatibly; no protocol version bump or new dependency is required.
- Adds Edge Native Messaging paths and one additional Windows HKCU registry entry while preserving Chrome installation behavior.
- Retains the existing single Chromium Extension build and `@panerelay` lockstep release model.
