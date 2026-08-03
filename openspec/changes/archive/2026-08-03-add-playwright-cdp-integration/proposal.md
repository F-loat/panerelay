## Why

Playwright CLI can operate an existing Chromium browser through a standard CDP endpoint, but Panerelay currently exposes only the Browser Use discovery gateway. That gateway is intentionally single-lane and Browser Use-specific, so Playwright cannot use the existing authorized-tab, control-lease, and revocation path without competing with Browser Use or relying on an incompatible bootstrap contract.

Playwright CLI is a useful second automation client because it provides tab listing/selection, accessibility snapshots, locators, and screenshots. Adding it now allows users and coding agents to reuse their signed-in Chrome tabs while preserving Panerelay's existing Extension authorization and Bridge policy boundary.

## What Changes

- Add a Panerelay-owned Playwright CDP discovery gateway on loopback, separate from the existing Browser Use gateway.
- Add a Playwright automation engine/lane that issues short-lived CDP bootstrap tickets through the shared Bridge relay.
- Support standard CDP version discovery, including clients that request `/json/version/` with a trailing slash.
- Keep Playwright participants independent from the Browser Use daemon and its single-connection lane.
- Add setup, doctor, adapter registration, and concise connection documentation for `@playwright/cli` 0.1.17 as the initial compatibility baseline.
- Verify `playwright-cli attach`, `tab-list`, `tab-select`, `snapshot`, navigation, input, screenshot, popup/tab lifecycle, cleanup, and authorization revocation against an existing Chrome profile.
- Preserve agent-browser 0.33.0 behavior and its current Verified compatibility groups; it remains an independent automation integration.
- Explicitly report unsupported Playwright browser-process features such as isolated contexts, launch-time flags, proxy ownership, and closing the user's browser.

Non-goals:

- Do not fork or modify Playwright or its CLI package.
- Do not make `/cdp/browser-use` multi-client or change Browser Use's existing daemon/lane semantics.
- Do not make Playwright's own Extension mode use the Panerelay Extension.
- Do not expose raw Chrome tab IDs or bypass site permission, tab authorization, control leases, or revocation.
- Do not claim Firefox, WebKit, mobile, headless daily-browser, or Playwright test-runner server compatibility from this change.

## Capabilities

### New Capabilities

- `playwright-cdp-connection`: Connect Playwright CLI to explicitly authorized existing Chromium tabs through a dedicated Panerelay gateway and shared CDP relay.

### Modified Capabilities

- `cdp-http-bootstrap`: Extend the bootstrap contract for a Playwright engine lane and tolerant standard CDP version discovery without weakening ticket authentication, one-shot credentials, bounds, or revocation.
- `stable-distribution`: Add Playwright CLI as an optional automation integration with its own version-specific compatibility baseline, setup selection, diagnostics, and release evidence.

## Impact

- Bridge: new Playwright discovery gateway, engine metadata, lane policy, and standard CDP version-path handling.
- Protocol: Playwright integration identifiers and bootstrap actor/engine typing where needed.
- CLI/setup: adapter registration, doctor checks, install/update/uninstall ownership, and concise explicit-connection guidance.
- Documentation: package README, setup guide/Skill, compatibility matrix, and release checklist.
- Tests: protocol and Bridge contract tests, CLI/setup tests, packed-consumer tests, and a real daily-Chrome run.
- Existing integrations: Browser Use 0.13.7 + Browser Harness 0.1.8 and agent-browser 0.33.0 must remain behaviorally compatible; their existing lanes and defaults remain unchanged.
