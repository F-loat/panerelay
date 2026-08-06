# Playwright CLI 0.1.17 compatibility

- Panerelay release: current development candidate
- Playwright CLI: 0.1.17
- Chrome status: Verified for the core existing-tab path described below
- Microsoft Edge status: Forwarded
- Last verified: 2026-08-06
- Last updated: 2026-08-06

This record applies to the upstream `playwright-cli` command attached explicitly to Panerelay's loopback CDP endpoint. It does not describe Playwright Test, Playwright's own Extension transport, or every later CLI release.

A dedicated macOS Edge 151 probe passed browser-specific routing, attach, authorized tab listing, snapshot, and detach. Edge remains `Forwarded` because the complete Chrome command matrix has not been repeated there.

## Status meanings

- **Verified**: deterministic contract tests pass and the command group has representative existing-Chrome evidence.
- **Automated**: deterministic contract tests pass, but this exact path has not completed a dedicated existing-Chrome run.
- **Partial**: the relay path is implemented, but the complete command group has not passed the pinned real-browser matrix yet.
- **Forwarded**: the browser shares the Chromium implementation, but dedicated representative runtime evidence is pending.
- **Unsupported**: the operation requires browser-process ownership or another guarantee Panerelay cannot provide and fails explicitly.

## Connection and command groups

| Command group | Chrome | Microsoft Edge | Evidence and boundary |
| --- | --- | --- | --- |
| `attach --cdp` and standard `/json/version[/]` discovery | Verified | Forwarded | Real CLI attach passed; contract tests cover bounded metadata, repeated discovery, one-shot WebSocket credentials, stale generations, and lane isolation. |
| Side Panel target-scoped attach and index `0` orientation | Automated | Forwarded | Environment, gateway, bootstrap, and relay tests bind canonical opaque browser/target UUIDs to the shared 56-character `-s=panerelay-v2-...` session, initialize the exact authorized target first, preserve ordinary lanes, and return bounded malformed, legacy, or target-unavailable failures without fallback. A dedicated injected-context Chrome/Edge run is pending. |
| `tab-list` | Verified | Forwarded | Real CLI and relay tests expose only authorized opaque targets. |
| `tab-select` | Verified | Forwarded | Logical selection works without granting authorization or intentionally changing the foreground tab. |
| `snapshot` and page evaluation | Verified | Forwarded | Real CLI snapshot/evaluation and shared-participant evaluation passed. |
| Navigation, locator actions, keyboard/mouse input, and forms | Verified | Forwarded | The pinned local fixture passed same-origin navigation, form fill/submit, and locator-driven input through the shared relay. |
| Dialogs, screenshots, frames, popup/new-tab discovery, and tab close | Verified | Forwarded | The pinned local fixture passed prompt handling, screenshot capture, frame snapshots, popup discovery/selection, and prompt tab close without blank-tab residue. |
| Playwright and Browser Use coexistence | Verified | Forwarded | Separate `playwright:panerelay` and `browser-use:panerelay` lanes connect simultaneously; target work remains serialized by the shared scheduler. The updated daily-Chrome run kept Browser Use on Bing and agent-browser on Google while Playwright attached to the shared authorized inventory and opened DuckDuckGo. |
| Participant release, transport loss, and authorization revocation | Verified | Forwarded | Existing contract and real-browser checks preserve unrelated participants and remove the released Playwright participant. The updated lockstep run detached the exact Playwright CLI session, left no Playwright browser session, preserved Browser Use and agent-browser access, and did not detach their shared targets. |
| Controlled favicon and restoration | Verified | Forwarded | Extension tests cover the official mark, passive-operation exclusion, current-document replacement, navigation behavior, fallback, and asynchronous best-effort cleanup. In daily Chrome, Playwright temporarily supplied the newest mark across all eight authorized tabs; detach restored Google to agent-browser, Bing to Browser Use, and DuckDuckGo to its site favicon. |

## Unsupported browser-owned features

| Feature | Status | Behavior |
| --- | --- | --- |
| Isolated BrowserContexts or disposable profiles | Unsupported | `Target.createBrowserContext` fails explicitly. |
| Launch-time executable, profile, extension, or browser flags | Unsupported | Panerelay attaches to an existing user-owned browser and does not launch it. |
| Launch-time proxy ownership or containment | Unsupported | Proxy parameters on isolated-context creation fail without changing Chrome. |
| Whole-browser close | Unsupported | `Browser.close` fails explicitly and does not close the user's browser. |
| Firefox, WebKit, mobile, headless, or Playwright Test server | Unsupported | No transport or compatibility claim is made by this integration. |

## Configuration boundary

Setup verifies Playwright CLI 0.1.17 or newer and installs only Panerelay-owned adapter files. It does not install or replace `playwright-cli`, edit `PATH` or shell startup files, create user-owned `.playwright/cli.config.json`, set a Playwright default, or manage an Agent Skill. The independently installed unified `panerelay-browser` Skill documents the explicit attach command and user-managed `PLAYWRIGHT_MCP_CDP_ENDPOINT`/`browser.cdpEndpoint` options.

The stable endpoint `http://127.0.0.1:43827/cdp/playwright` is loopback discovery, not a persistent credential. Dynamic ticket and WebSocket credentials remain short-lived, participant-scoped, generation-bound, and invalid after use or revocation.

New Side Panel conversations may instead inject a target-scoped endpoint under `/cdp/playwright/target/<opaque-selection>` plus a compact derived CLI session. The 56-character session reversibly encodes the canonical opaque browser and target UUID bytes within the shared 64-character portable boundary; the gateway still mints the authenticated short-lived bootstrap and WebSocket credentials. The target hint is locating data only and creates no permission, authorization, attachment, or control state by itself.

An unpacked Extension reload cannot reconstruct a favicon that an older Extension background already replaced after that background's isolated document state is gone. Such a cached mark is not evidence of a live Playwright claim; the page restores its own favicon on its next safe navigation or reload. The 2026-08-06 acceptance left two pre-update business pages untouched instead of reloading user state, while every page first claimed by the updated build completed the expected fallback or restoration.
