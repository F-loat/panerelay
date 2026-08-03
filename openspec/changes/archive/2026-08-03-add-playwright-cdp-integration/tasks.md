## 1. Protocol and shared bootstrap

- [x] 1.1 Add `playwright` to the automation-engine and adapter manifest/registry surface with bounded validation.
- [x] 1.2 Extend CDP bootstrap request handling to preserve engine/lane metadata and accept `/json/version` and `/json/version/` without weakening ticket, credential, bound, or revocation checks.
- [x] 1.3 Add protocol tests for Playwright bootstrap payloads, invalid engine/lane values, trailing-slash version paths, and stale-generation failures.

## 2. Bridge gateway and participant lifecycle

- [x] 2.1 Implement the loopback Playwright discovery gateway and browser-selection token handling by reusing the shared authenticated `/cdp/bootstrap` flow.
- [x] 2.2 Assign a dedicated Playwright actor/lane and keep Browser Use's gateway, daemon, single-connection policy, and environment unchanged.
- [x] 2.3 Add Bridge contract tests for discovery metadata, lane isolation, Browser Use/Playwright coexistence, repeated version requests, standard WebSocket connection, target list/select behavior, and per-target serialization.
- [x] 2.4 Add Bridge cleanup tests for explicit detach, participant transport loss, Native Host generation replacement, Extension revocation, and stale bootstrap URLs.
- [x] 2.5 Verify unsupported BrowserContext, browser-process ownership, launch-option, proxy, and browser-close operations fail explicitly without mutating Chrome.
- [x] 2.6 Add a distinct Playwright controlled favicon mapping and Extension mapping coverage; preserve agent-browser and Browser Use icons.

## 3. Playwright CLI integration and setup

- [x] 3.1 Add the optional Playwright CLI adapter package or module with `@playwright/cli` 0.1.17 probing, manifest, extension-mode connection resolution, doctor checks, and dedicated concurrency metadata.
- [x] 3.2 Add setup flags, registry lifecycle, install/update/uninstall cleanup, and protected adapter registration for Playwright without installing or modifying the upstream CLI.
- [x] 3.3 Add concise documentation for `PLAYWRIGHT_MCP_CDP_ENDPOINT`, `.playwright/cli.config.json`, and explicit `attach --cdp`; do not modify shell startup, PATH, or user-owned Playwright configuration.
- [x] 3.4 Add CLI/setup and gateway-selection tests for explicit selection and default-preserving states.

## 4. Compatibility and documentation

- [x] 4.1 Add a Playwright CLI compatibility record covering Chrome and Edge status, verified command groups, partial behavior, and unsupported browser-owned features.
- [x] 4.2 Add setup README, Skill, quickstart, and CLI examples for `attach`, `tab-list`, `tab-select`, `snapshot`, and endpoint configuration.
- [x] 4.3 Update the relevant RFC with the new engine lane and confirm that Browser Use remains single-lane while shared relay participants remain policy-controlled.
- [x] 4.4 Add release-checklist and compatibility validation for the pinned Playwright CLI 0.1.17 baseline while preserving agent-browser 0.33.0 and Browser Use 0.13.7 evidence.

## 5. Real-browser verification and release hygiene

- [x] 5.1 Run a local fixture against an existing authorized Chrome profile: attach, list/select tabs, snapshot, navigation, input, dialogs, screenshot, popup/new-tab discovery, and close/detach.
- [x] 5.2 Verify simultaneous Browser Use and Playwright participants, target mutation serialization, no foreground stealing, explicit user release, and authorization revocation cleanup.
- [x] 5.3 Run representative Edge verification and keep it `Forwarded` unless dedicated evidence passes; do not claim Firefox/WebKit or isolated-context support.
- [x] 5.4 Run `pnpm install --frozen-lockfile`, `pnpm run check`, `git diff --check`, packed-consumer tests, and remove temporary credentials, screenshots, browser logs, and generated fixtures from the repository.
