# agent-browser 0.33.0 compatibility

- Panerelay release: stable `0.1.0`
- agent-browser: 0.33.0
- Support policy: minimum supported version and initial version-specific verified baseline
- Connection: browser-level Provider over Native Messaging
- Last verified: 2026-07-29

agent-browser versions newer than 0.33.0 satisfy Panerelay's minimum-version check, but they do not
inherit this file's `Verified` classifications. Record a separate version-specific compatibility
report before describing a newer version as verified.

## Status meanings

- **Verified**: covered by automated tests and exercised against an unpacked Panerelay Extension in
  an existing Chrome profile.
- **Automated**: covered by deterministic contract or Extension tests; a dedicated daily-Chrome
  acceptance scenario has not yet been completed.
- **Forwarded**: uses page-scoped CDP that Panerelay routes without a command allowlist, but does not
  yet have a dedicated daily-Chrome acceptance scenario.
- **Partial**: the main command works, with a documented browser-ownership limitation.
- **Unsupported**: Panerelay rejects the operation or the option cannot apply to an already running
  daily browser.

## Connection and page automation

| agent-browser capability                    | Status    | Notes                                                                                           |
| ------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| Provider selection and global default       | Verified  | `@panerelay/setup` installs the Provider and can set it globally.                               |
| Browser-level handshake                     | Verified  | Target discovery, virtual flattened page sessions, and lazy debugger attachment pass.           |
| `snapshot`, `get`, `eval`                   | Verified  | Accessibility, DOM, and Runtime commands operate on the authorized active tab.                  |
| `open`, `reload`, `back`, `forward`, `wait` | Verified  | Navigation stays within Chrome site-access authorization.                                       |
| `click`, `fill`                             | Verified  | Page interaction and resulting application state pass on the local fixture.                     |
| `dblclick`, `hover`, `focus`, `drag`, mouse | Forwarded | Routed through page-scoped DOM, Runtime, and Input domains.                                     |
| `type`, `press`, keyboard, check, select    | Forwarded | Routed through page-scoped Runtime and Input domains.                                           |
| screenshot                                  | Verified  | `Page.captureScreenshot` works through Native Messaging chunking.                               |
| annotated screenshot                        | Forwarded | Uses the same screenshot and DOM surface; dedicated evidence is pending.                        |
| PDF                                         | Verified  | A 4.3 MB PDF passed Native Messaging chunking and was written as a readable local artifact.     |
| upload                                      | Verified  | Agent-local file selection and page-observed metadata pass without Extension filesystem access. |
| download                                    | Partial   | Agent-selected paths require `Browser.setDownloadBehavior`; Panerelay rejects it explicitly.    |
| dialogs                                     | Forwarded | Page dialog events and handling are routed for controlled targets.                              |
| init scripts                                | Forwarded | Applies only after the Agent connects; it cannot affect a page load that already happened.      |

## Targets and browser state

| agent-browser capability                        | Status      | Notes                                                                           |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `tab`, `tab new`, switch, close                 | Verified    | Existing authorized tabs and Agent-created tabs use stable session-local IDs.   |
| JavaScript popups                               | Verified    | Newly created eligible page targets are discovered and can be selected.         |
| cross-origin iframe and worker sessions         | Partial     | Flattened child sessions are routed; auto-attach does not pause child startup.  |
| cookies: get, set, single-cookie expiry         | Verified    | Explicit URLs and domains are limited to the selected authorized target origin. |
| cookies: clear or whole-profile access          | Unsupported | Panerelay rejects methods that read or clear the daily Chrome profile globally. |
| local/session storage                           | Verified    | Implemented by Runtime evaluation in the selected tab.                          |
| new isolated window / browser context           | Unsupported | A normal Chrome window is not an isolated CDP browser context.                  |
| closing Chrome                                  | Unsupported | Panerelay never maps `Browser.close` to the user's daily browser.               |
| concurrent automation leases                    | Unsupported | One Agent owns the browser mutation lease at a time.                            |
| internal Chrome, Web Store, and Extension pages | Unsupported | Only debugger-compatible authorized HTTP(S) targets are exposed.                |

## Control session and activity

| capability                         | Status      | Notes                                                                                                                                            |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transparent heartbeat renewal      | Verified    | An idle Provider session remained usable after 38 seconds with a 35-second lease deadline.                                                       |
| Multi-transport liveness           | Verified    | Automated Bridge coverage keeps the lease while any authenticated transport remains responsive.                                                  |
| Expiry and stale reconnect cleanup | Verified    | Deterministic tests cover closed transport, target detach, pending failure, and rejected stale credentials.                                      |
| Normal Provider release            | Verified    | Direct close and terminal Qoder ACP turns released their scoped control leases without changing tab authorization.                               |
| Immediate user release             | Verified    | The settings panel exposes release while active; automated integration coverage verifies terminal cleanup.                                       |
| Per-tab controlled favicon         | Forwarded   | Extension tests cover command-triggered icon injection, SPA resistance, refresh clearing, and restoration; daily-Chrome verification is pending. |
| Sanitized activity lifecycle       | Verified    | Real page and tab commands rendered localized completed rows; protocol tests reject raw sensitive fields.                                        |
| Bounded replay and history gaps    | Verified    | Bridge and Extension tests cover ring limits, epochs, sequence gaps, and reconnect snapshots.                                                    |
| Durable activity history           | Unsupported | Activity is intentionally memory-only and is cleared across process histories.                                                                   |

Real-browser evidence covers active heartbeat, completed page activity, tab activity, direct
Provider release, and two consecutive Qoder CLI 1.1.2 browser turns. Each Qoder terminal event was
followed by an inactive browser connection, and a separate agent-browser session immediately
acquired control. Forced heartbeat expiry, Bridge-restart gaps, and injected failed or denied CDP
commands remain automated-test scenarios to avoid perturbing the user's daily browser profile.

## Diagnostics, network, and emulation

| agent-browser capability      | Status      | Notes                                                                                                     |
| ----------------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| console and page errors       | Verified    | Runtime events are routed per target.                                                                     |
| `inspect` / Chrome DevTools   | Unsupported | Opening DevTools displaces the Extension debugger, so the affected target detaches.                       |
| request list                  | Verified    | Network events and response metadata are routed per target.                                               |
| request detail and HAR        | Verified    | Fixture request metadata/body and a readable one-entry HAR pass per target.                               |
| request routes and mocks      | Verified    | Fetch-domain response replacement passes on an attached local target.                                     |
| headers, credentials, offline | Verified    | Header echo, Basic credentials, offline observation, reset, and session cleanup pass.                     |
| viewport, media, user agent   | Verified    | Page emulation passes and detaches cleanly; the real Chrome window is not resized.                        |
| timezone and locale           | Forwarded   | CDP contract coverage passes; agent-browser 0.33.0 exposes no matching CLI or MCP command.                |
| geolocation                   | Partial     | Page emulation is forwarded, but browser-level permission grants are not.                                 |
| accessibility audit           | Verified    | Structured axe results preserve a selector path into a same-origin iframe.                                |
| trace and profiler            | Verified    | Multi-megabyte trace and profiler artifacts are readable after bounded fixture runs.                      |
| recording and streaming       | Partial     | Streaming passes; `record start` needs a context, while current-target recording also needs local ffmpeg. |

## Provider options

| option                                       | Status      | Notes                                                                                           |
| -------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `--allowed-domains`                          | Unsupported | An Extension cannot pause a new top-level tab before its first request; Panerelay fails closed. |
| `--profile`, `--state`, `--restore`          | Unsupported | Panerelay reuses the running profile and does not replace or replay its state.                  |
| `--proxy`, `--proxy-bypass`                  | Unsupported | Browser launch networking cannot be changed after Chrome starts.                                |
| `--executable-path`, `--args`, `--extension` | Unsupported | Panerelay connects to the existing browser instead of launching one.                            |
| `--headed`, engine selection                 | Unsupported | The connected Chrome instance determines the browser and display mode.                          |
| `--download-path`                            | Partial     | Panerelay rejects Chrome-wide download behavior instead of writing to an uncontrolled location. |

`agent-browser mcp`, `chat`, and the dashboard use the same underlying command surface, so their
browser-control coverage follows this matrix rather than defining a separate transport capability.

## Side-panel provider sessions

The side-panel providers create scoped agent-browser `0.33.0` MCP connections when a conversation
uses browser tools. Conversation workspace behavior is Extension-private and does not alter
agent-browser commands, authorization, or control leases.

| capability                                | Status    | Notes                                                                                                        |
| ----------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| Selected-provider preparation             | Automated | Codex app-server and Qoder ACP initialize idempotently without listing history or creating a conversation.   |
| Lazy recent-conversation history          | Automated | History loads on explicit open and covers loading, search, empty, error, retry, and resume states.           |
| Draft-first conversation creation         | Automated | “New” stays local until the first non-empty message, then starts, binds, and sends exactly once.             |
| Active-tab conversation restoration       | Automated | Opaque revisions reject stale async results and restore cached or provider-native conversation state.        |
| Trusted related-tab workspace inheritance | Automated | Only Chrome-reported opener/navigation-target relationships inherit; authorization and leases stay separate. |

Daily-Chrome verification of provider warm-up, lazy history, draft-first send, active-tab
restoration, and related-tab inheritance remains pending.

## Stable distribution boundaries

- The Extension, protocol, Provider, Bridge, and setup CLI are one lockstep compatibility unit;
  `0.1.0` does not negotiate with a different Panerelay build.
- Candidate validation packs all four npm packages, installs them outside the workspace, and runs
  setup, doctor, update, and uninstall in disposable user state.
- Native Messaging setup supports macOS, Linux, and current-user Windows Chrome registration.
- Installing the candidate does not grant Chrome site permission, authorize a tab, or acquire a
  control lease.
- The daily-profile ownership limitations recorded in the tables above are unchanged by packaging.

## Deferred final-candidate evidence

The retained `0.1.0` candidate passes the automated source, packed-artifact, and integrity gates.
After its final rebuild, however, it was not reinstalled into daily Chrome to repeat doctor,
control-visibility, authorization-revocation, and cleanup acceptance. The real-browser evidence
above was collected from the corresponding source build rather than the retained package.

Real Windows Chrome acceptance for Native Messaging launch, update, uninstall, and paths containing
spaces was also not run. Windows coverage for this candidate is limited to deterministic and CI
checks.

Archiving `prepare-first-stable-release` records implementation completion under these
maintainer-approved evidence deferrals; it does not declare the candidate releasable. The
`stable-distribution` acceptance requirement remains unchanged, so the candidate stays not ready
until the missing evidence passes or a later explicit release decision changes that policy. No
package publication, Git tag, upload, or external release is part of this closeout.
