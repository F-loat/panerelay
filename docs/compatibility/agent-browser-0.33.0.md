# agent-browser 0.33.0 compatibility

- PaneRelay baseline: pre-alpha / RFC-0003
- agent-browser: 0.33.0
- Connection: browser-level Provider over Native Messaging
- Alpha distribution: lockstep `0.1.0-alpha.1` candidate
- Last verified: 2026-07-29

## Status meanings

- **Verified**: covered by automated tests and exercised against an unpacked PaneRelay Extension in
  an existing Chrome profile.
- **Forwarded**: uses page-scoped CDP that PaneRelay routes without a command allowlist, but does not
  yet have a dedicated daily-Chrome acceptance scenario.
- **Partial**: the main command works, with a documented browser-ownership limitation.
- **Unsupported**: PaneRelay rejects the operation or the option cannot apply to an already running
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
| download                                    | Partial   | Agent-selected paths require `Browser.setDownloadBehavior`; PaneRelay rejects it explicitly.    |
| dialogs                                     | Forwarded | Page dialog events and handling are routed for controlled targets.                              |
| init scripts                                | Forwarded | Applies only after the Agent connects; it cannot affect a page load that already happened.      |

## Targets and browser state

| agent-browser capability                        | Status      | Notes                                                                           |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `tab`, `tab new`, switch, close                 | Verified    | Existing authorized tabs and Agent-created tabs use stable session-local IDs.   |
| JavaScript popups                               | Verified    | Newly created eligible page targets are discovered and can be selected.         |
| cross-origin iframe and worker sessions         | Partial     | Flattened child sessions are routed; auto-attach does not pause child startup.  |
| cookies: get, set, single-cookie expiry         | Verified    | Explicit URLs and domains are limited to the selected authorized target origin. |
| cookies: clear or whole-profile access          | Unsupported | PaneRelay rejects methods that read or clear the daily Chrome profile globally. |
| local/session storage                           | Verified    | Implemented by Runtime evaluation in the selected tab.                          |
| new isolated window / browser context           | Unsupported | A normal Chrome window is not an isolated CDP browser context.                  |
| closing Chrome                                  | Unsupported | PaneRelay never maps `Browser.close` to the user's daily browser.               |
| concurrent automation leases                    | Unsupported | One Agent owns the browser mutation lease at a time.                            |
| internal Chrome, Web Store, and Extension pages | Unsupported | Only debugger-compatible authorized HTTP(S) targets are exposed.                |

## Control session and activity

| capability                         | Status      | Notes                                                                                                                                          |
| ---------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Transparent heartbeat renewal      | Verified    | An idle Provider session remained usable after 38 seconds with a 35-second lease deadline.                                                     |
| Multi-transport liveness           | Verified    | Automated Bridge coverage keeps the lease while any authenticated transport remains responsive.                                                |
| Expiry and stale reconnect cleanup | Verified    | Deterministic tests cover closed transport, target detach, pending failure, and rejected stale credentials.                                    |
| Normal Provider release            | Verified    | Closing the real agent-browser session released its control lease without changing tab authorization.                                          |
| Immediate user release             | Verified    | The settings panel exposes release while active; automated integration coverage verifies terminal cleanup.                                     |
| Per-tab controlled favicon         | Forwarded   | Extension tests cover agent-browser icon injection, SPA resistance, navigation reapply, and restoration; daily-Chrome verification is pending. |
| Sanitized activity lifecycle       | Verified    | Real page and tab commands rendered localized completed rows; protocol tests reject raw sensitive fields.                                      |
| Bounded replay and history gaps    | Verified    | Bridge and Extension tests cover ring limits, epochs, sequence gaps, and reconnect snapshots.                                                  |
| Durable activity history           | Unsupported | Activity is intentionally memory-only and is cleared across process histories.                                                                 |

Real-browser evidence covers active heartbeat, completed page activity, tab activity, and normal
Provider release. Forced heartbeat expiry, Bridge-restart gaps, and injected failed or denied CDP
commands remain automated-test scenarios to avoid perturbing the user's daily browser profile.

## Diagnostics, network, and emulation

| agent-browser capability      | Status    | Notes                                                                                                     |
| ----------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| console and page errors       | Verified  | Runtime events are routed per target.                                                                     |
| request list                  | Verified  | Network events and response metadata are routed per target.                                               |
| request detail and HAR        | Verified  | Fixture request metadata/body and a readable one-entry HAR pass per target.                               |
| request routes and mocks      | Verified  | Fetch-domain response replacement passes on an attached local target.                                     |
| headers, credentials, offline | Verified  | Header echo, Basic credentials, offline observation, reset, and session cleanup pass.                     |
| viewport, media, user agent   | Verified  | Page emulation passes and detaches cleanly; the real Chrome window is not resized.                        |
| timezone and locale           | Forwarded | CDP contract coverage passes; agent-browser 0.33.0 exposes no matching CLI or MCP command.                |
| geolocation                   | Partial   | Page emulation is forwarded, but browser-level permission grants are not.                                 |
| accessibility audit           | Verified  | Structured axe results preserve a selector path into a same-origin iframe.                                |
| trace and profiler            | Verified  | Multi-megabyte trace and profiler artifacts are readable after bounded fixture runs.                      |
| recording and streaming       | Partial   | Streaming passes; `record start` needs a context, while current-target recording also needs local ffmpeg. |

## Provider options

| option                                       | Status      | Notes                                                                                           |
| -------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `--allowed-domains`                          | Unsupported | An Extension cannot pause a new top-level tab before its first request; PaneRelay fails closed. |
| `--profile`, `--state`, `--restore`          | Unsupported | PaneRelay reuses the running profile and does not replace or replay its state.                  |
| `--proxy`, `--proxy-bypass`                  | Unsupported | Browser launch networking cannot be changed after Chrome starts.                                |
| `--executable-path`, `--args`, `--extension` | Unsupported | PaneRelay connects to the existing browser instead of launching one.                            |
| `--headed`, engine selection                 | Unsupported | The connected Chrome instance determines the browser and display mode.                          |
| `--download-path`                            | Partial     | PaneRelay rejects Chrome-wide download behavior instead of writing to an uncontrolled location. |

`agent-browser mcp`, `chat`, and the dashboard use the same underlying command surface, so their
browser-control coverage follows this matrix rather than defining a separate transport capability.

## Alpha distribution boundaries

- The Extension, protocol, Provider, Bridge, and setup CLI are one lockstep compatibility unit;
  `0.1.0-alpha.1` does not negotiate with a different PaneRelay build.
- Candidate validation packs all four npm packages, installs them outside the workspace, and runs
  setup, doctor, update, and uninstall in disposable user state.
- Native Messaging setup is supported on macOS and Linux. Windows remains unsupported.
- Installing the candidate does not grant Chrome site permission, authorize a tab, or acquire a
  control lease.
- The daily-profile ownership limitations recorded in the tables above are unchanged by packaging.
