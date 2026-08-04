# agent-browser 0.33.0 compatibility

- Panerelay release: current stable channel
- agent-browser: 0.33.0
- Support policy: minimum supported version and initial version-specific verified baseline
- Connection: browser-level Provider over Native Messaging
- Last verified: 2026-08-01
- Last updated: 2026-08-04

agent-browser versions newer than 0.33.0 satisfy Panerelay's minimum-version check, but they do not inherit this file's `Verified` classifications. Record a separate version-specific compatibility report before describing a newer version as verified.

## Status meanings

- **Verified**: covered by automated tests and exercised against an unpacked Panerelay Extension in an existing Chrome profile.
- **Automated**: covered by deterministic contract or Extension tests; a dedicated daily-Chrome acceptance scenario has not yet been completed.
- **Forwarded**: uses page-scoped CDP that Panerelay routes without a command allowlist, but does not yet have a dedicated daily-Chrome acceptance scenario.
- **Partial**: the main command works, with a documented browser-ownership limitation.
- **Unsupported**: Panerelay rejects the operation or the option cannot apply to an already running daily browser.

## Connection and page automation

| agent-browser capability | Status | Notes |
| --- | --- | --- |
| Provider selection and global default | Verified | `@panerelay/setup --agent-browser` installs the Provider and can set it globally; plain setup does not probe or configure agent-browser. |
| Browser-level handshake | Verified | Target discovery and flattened page sessions remain virtual; page/runtime/network subscriptions attach as visible observation without entering the controlled count. |
| `snapshot`, `get`, `eval` | Verified | Accessibility, DOM, and Runtime commands operate on the Agent-selected authorized target, including background tabs. |
| `open`, `reload`, `back`, `forward`, `wait` | Verified | Navigation stays within Chrome site-access authorization. |
| `click`, `fill` | Verified | Page interaction and resulting application state pass on the local fixture. |
| `dblclick`, `hover`, `focus`, `drag`, mouse | Forwarded | Routed through page-scoped DOM, Runtime, and Input domains. |
| `type`, `press`, keyboard, check, select | Forwarded | Routed through page-scoped Runtime and Input domains. |
| screenshot | Verified | `Page.captureScreenshot` works through Native Messaging chunking. |
| annotated screenshot | Forwarded | Uses the same screenshot and DOM surface; dedicated evidence is pending. |
| PDF | Verified | A 4.3 MB PDF passed Native Messaging chunking and was written as a readable local artifact. |
| upload | Verified | Agent-local file selection and page-observed metadata pass without Extension filesystem access. |
| download | Partial | Agent-selected paths require `Browser.setDownloadBehavior`; Panerelay rejects it explicitly. |
| dialogs | Forwarded | Page dialog events and handling are routed for controlled targets. |
| init scripts | Forwarded | Applies only after the Agent connects; it cannot affect a page load that already happened. |

## Targets and browser state

| agent-browser capability | Status | Notes |
| --- | --- | --- |
| `tab`, `tab new`, switch, close | Verified | The initial authorized inventory and Agent-created tabs use stable session-local IDs. Without all-tabs authorization, `tab new` fails closed and directs the user to an Extension-side authorization action. |
| Side Panel conversation target to session-local `t1` | Automated | Provider, protocol, and relay tests bind the exact reserved `panerelay-tab-v1-<browser-uuid>-<target-uuid>` session to its named live browser, order the hinted authorized target first, and fail closed on malformed, stale, wrong-browser, or revoked hints. The injected-context daily-Chrome acceptance scenario has not yet run, so this is not promoted to `Verified`. |
| Background target selection | Verified | `tab <id>`, `Target.activateTarget`, and `Page.bringToFront` update or acknowledge Agent-local selection without activating a Chrome tab or focusing its window. `tab new` creates an inactive tab. |
| Controlled-lineage target discovery | Verified | After initial seeding, independently opened tabs stay private; Agent-created tabs and Chrome-reported descendants of controlled tabs expand the exposed inventory. Later target lists remain bounded to that inventory. |
| JavaScript popups | Verified | Eligible page targets opened from a controlled source are discovered and can be selected. |
| cross-origin iframe and worker sessions | Partial | Flattened child sessions use participant-local opaque identifiers; iframe auto-attach is recursive and does not pause child startup. Browser Harness OOPIF coverage is verified, while the broader agent-browser worker matrix remains partial. |
| cookies: get, set, single-cookie expiry | Verified | Explicit URLs and domains are limited to the selected authorized target origin. |
| cookies: clear or whole-profile access | Unsupported | Panerelay rejects methods that read or clear the daily Chrome profile globally. |
| local/session storage | Verified | Implemented by Runtime evaluation in the selected tab. |
| new isolated window / browser context | Unsupported | A normal Chrome window is not an isolated CDP browser context. |
| closing Chrome | Unsupported | Panerelay never maps `Browser.close` to the user's daily browser. |
| multiple agent-browser sessions | Verified | Two independently named sessions listed and read the same authorized daily-Chrome target without release or reauthorization. They share one Panerelay lease and debugger attachment while keeping virtual CDP sessions isolated and target commands serialized. |
| overlapping target mutation | Automated | Bridge tests serialize complete command lifecycles FIFO per target; different targets may progress independently. |
| internal Chrome, Web Store, and Extension pages | Unsupported | Only debugger-compatible authorized HTTP(S) targets are exposed. |

## Control session and activity

| capability | Status | Notes |
| --- | --- | --- |
| Transparent heartbeat renewal | Verified | An idle Provider session remained usable after 38 seconds with a 35-second lease deadline. |
| Multi-transport liveness | Verified | Automated Bridge coverage keeps the lease while any authenticated transport remains responsive. |
| Per-participant liveness | Automated | An unresponsive participant expires without disconnecting another responsive participant. |
| Expiry and stale reconnect cleanup | Verified | Deterministic tests cover closed transport, target detach, pending failure, and rejected stale credentials. |
| Normal Provider release | Verified | Closing one of two daily-Chrome participants preserved the other participant and its page access; the final close released the shared lease without changing tab authorization. |
| Immediate user release | Verified | Deterministic Extension coverage verifies complete-lease cleanup. A daily-Chrome settings run confirmed that clicking the selected current-tab or all-tabs scope clears that selection, while the separate release action preserves the selected scope. Prior daily-Chrome evidence verifies that release immediately terminates the active lease and detaches observed and controlled targets. |
| Read-only observation state | Verified | Passive page/runtime/network setup and explicitly allowlisted reads retain events while reporting a separate observed-target count, zero controlled targets, and no controlled favicon. `Runtime.evaluate` and unknown methods fail closed into control. |
| Per-tab controlled favicon | Forwarded | Bridge and Extension tests keep discovery, passive setup, and allowlisted reads from changing the controlled count or favicon; the first control-class command, SPA resistance, refresh clearing, and restoration are covered. Daily-Chrome verification of the new observation/control split is pending. |
| Sanitized activity lifecycle | Verified | Real page and tab commands rendered localized completed rows; protocol tests reject raw sensitive fields. |
| Bounded replay and history gaps | Verified | Bridge and Extension tests cover ring limits, epochs, sequence gaps, and reconnect snapshots. |
| Durable activity history | Unsupported | Activity is intentionally memory-only and is cleared across process histories. |

Real-browser evidence covers active heartbeat, completed page activity, tab activity, direct Provider release, and two simultaneously live agent-browser 0.33.0 participants. Both named participants listed the same eight authorized tabs and concurrently read the same GitHub target. Closing the first left the second usable; closing the second completed cleanup without changing tab authorization.

A later daily-Chrome focus-isolation run kept one user-visible tab active while an Agent selected a different authorized target, read its title, and captured its accessibility snapshot. Fresh observer participants continued to report the original Chrome-active target. The Agent then created an inactive `about:blank` target, observer participants still reported the original active target, and closing the background target did not change it. After the user independently changed the visible tab, an Agent DOM-focus command succeeded on the background target without pulling Chrome back to it. Every verification participant was released independently afterward.

The 2026-07-30 observation/control run created an inactive loopback fixture tab whose page scheduled repeated `/early` requests. Before any control-class command, an allowlisted raw `DOM.getDocument` plus `DOM.querySelector` found no `data-panerelay-controlled-favicon`, while agent-browser's cached request list already contained successful fixture requests. The first `Runtime.evaluate` observed the Panerelay marker during its own execution, and a repeated evaluation still found exactly one marker. Deterministic Bridge and Extension tests additionally verify the corresponding observed-target to controlled-target count transition. The fixture tab, Agent participants, and temporary server were removed afterward.

The 2026-07-31 controlled-lineage run initialized one Agent participant, opened an independent loopback tab through Mearl, and confirmed that it stayed absent from both that participant and a freshly initialized second participant. An Agent-created parent and a child opened from that controlled parent each appeared exactly once. A separate Agent-created source remained observation-only; a Chrome tab opened with that source as its explicit opener stayed absent from both participants, confirming that observed lineage does not expand the inventory. Both Agent participants, every fixture tab, and the temporary server were removed afterward.

Forced heartbeat expiry, Bridge-restart gaps, and injected failed or denied CDP commands remain automated-test scenarios to avoid perturbing the user's daily browser profile.

## Diagnostics, network, and emulation

| agent-browser capability | Status | Notes |
| --- | --- | --- |
| console and page errors | Verified | Runtime events are routed per target. |
| `inspect` / Chrome DevTools | Unsupported | Opening DevTools displaces the Extension debugger, so the affected target detaches. |
| request list | Verified | Network events and response metadata are routed per target; deterministic regression coverage receives an early request event before any control-class command. |
| request detail and HAR | Verified | Fixture request metadata/body and a readable one-entry HAR pass per target. |
| request routes and mocks | Verified | Fetch-domain response replacement passes on an attached local target. |
| headers, credentials, offline | Verified | Header echo, Basic credentials, offline observation, reset, and session cleanup pass. |
| viewport, media, user agent | Verified | Page emulation passes and detaches cleanly; the real Chrome window is not resized. |
| timezone and locale | Forwarded | CDP contract coverage passes; agent-browser 0.33.0 exposes no matching CLI or MCP command. |
| geolocation | Partial | Page emulation is forwarded, but browser-level permission grants are not. |
| accessibility audit | Verified | Structured axe results preserve a selector path into a same-origin iframe. |
| trace and profiler | Verified | Multi-megabyte trace and profiler artifacts are readable after bounded fixture runs. |
| recording and streaming | Partial | Streaming passes; `record start` needs a context, while current-target recording also needs local ffmpeg. |

## Provider options

| option | Status | Notes |
| --- | --- | --- |
| `--allowed-domains` | Unsupported | An Extension cannot pause a new top-level tab before its first request; Panerelay fails closed. |
| `--profile`, `--state`, `--restore` | Unsupported | Panerelay reuses the running profile and does not replace or replay its state. |
| `--proxy`, `--proxy-bypass` | Unsupported | Browser launch networking cannot be changed after Chrome starts. |
| `--executable-path`, `--args`, `--extension` | Unsupported | Panerelay connects to the existing browser instead of launching one. |
| `--headed`, engine selection | Unsupported | The connected Chrome instance determines the browser and display mode. |
| `--download-path` | Partial | Panerelay rejects Chrome-wide download behavior instead of writing to an uncontrolled location. |

`agent-browser mcp`, `chat`, and the dashboard use the same underlying command surface, so their browser-control coverage follows this matrix rather than defining a separate transport capability.

## Side-panel provider sessions

Side-panel providers do not create or close agent-browser MCP connections. They keep the selected project as the Agent working directory, add canonical `$panerelay-browser` availability guidance, and pass only bounded, redacted current-tab URL/title context plus a staleable registration hint without filesystem paths. Any agent-browser MCP or Skill is loaded from the Agent's own configuration and remains subject to normal Panerelay authorization and control leases.

| capability | Status | Notes |
| --- | --- | --- |
| Selected-provider preparation | Verified | Codex app-server and Qoder ACP initialize idempotently without listing history or creating a conversation. |
| Provider child command environment | Verified | Setup captures a bounded absolute command-search path in the protected runtime configuration, and the Native Host passes one reconstructed environment to every built-in provider. POSIX, Windows, AgentService, installation, and Qoder ACP regressions pass. A Qoder-selected daily-Chrome run confirmed the Agent environment resolves its normally installed browser command after Native Host setup refresh. |
| Lazy recent-conversation history | Verified | History loads on explicit open and covers loading, search, empty, error, retry, and resume states. |
| Draft-first conversation creation | Verified | “New” stays local until the first non-empty message, then starts, binds, and sends exactly once. |
| Active-tab conversation restoration | Verified | Opaque revisions reject stale async results and restore cached or provider-native conversation state. |
| Page-created related-tab workspace inheritance | Automated | Only `webNavigation.onCreatedNavigationTarget` relationships inherit. Browser-created tabs remain independent even when Chrome exposes opener-like metadata; authorization and leases stay separate. |
| Per-tab new-conversation detachment | Automated | Starting a new conversation gives only the active tab a new group and draft; sibling tabs keep the prior conversation and later sends cannot replace one another. |
| Draft project directory | Verified | A native picker returns one canonical directory; the draft inherits it across trusted related tabs, starts the provider in it, and makes it immutable once the conversation is bound. |
| Current model display | Automated | For an installed provider, the header prefers bounded provider-reported conversation metadata and then a prepared configured or catalog-default model. Unknown and unavailable-provider models are omitted; model selection stays provider-owned. |
| Panerelay Skill guidance | Automated | New conversations prefer `$panerelay-browser`, tell the Agent to attempt the canonical `npx skills` installation when unavailable, and allow another browser tool only after installation cannot complete and the fallback is disclosed. Existing Provider/adapter registrations supply a cached fast path that skips generic preflight checks before direct invocation; stale hints fall back to targeted diagnostics and never widen browser authorization. |
| New-session URL/title and ACP context privacy | Verified | Bounded, redacted URL/title context is passed without raw Chrome tab IDs. Codex uses developer instructions; Qoder and OpenCode place it in the exact `<panerelay-context version="1">` / `</panerelay-context>` first-prompt envelope because ACP v1 has no equivalent hidden instruction field. Loaded Side Panel history strips only a complete recognized envelope or exact legacy prefix after chunk assembly; provider-native transcripts may retain it. URL/title metadata alone selects no automation session or target. |
| New-session exact target orientation | Automated | New conversations additionally carry opaque browser/target UUIDs and bounded engine commands. For agent-browser, the reserved session selects the exact live browser and maps the already-authorized target to `t1`; Browser Use and Playwright consume their own pinned mechanisms. The hint is non-authorizing and fails without URL/title fallback. |
| Page comments, including authorized iframes | Verified | Single-click one-shot and double-click continuous selection coordinate the picker across currently reachable frames and use an anchored compact editor, reversible style previews, pencil markers, and Side Panel annotation pills. Subframe evidence includes bounded frame metadata without a raw Chrome frame ID. Evidence excludes form values, is delimited as untrusted, and clears on send or tab/document/permission lifecycle changes. Frames outside current Chrome host permissions remain untouched. |
| Clipboard image input | Verified | The two-line composer previews and removes PNG/JPEG/WebP/GIF inputs, supports image-only turns, preserves failed sends, and enforces 4-image/10-MiB-each/20-MiB-total bounds in both Extension and Bridge. Codex uses data URLs; Qoder uses negotiated ACP image blocks. |
| Automatic Agent approvals | Verified | The persisted preference defaults off and responds only to current-conversation requests offering one-shot `accept`; session-wide decisions, Chrome permissions, and browser leases remain manual and separate. |
| User-level default Agent controls | Automated | Extension settings read, set, and conditionally clear only a current Panerelay default through the Native Host; setup CLI scope options remain available. |
| Native Host and Provider recovery guidance | Automated | Recognized missing-host and Panerelay plugin signatures show bounded setup or retry guidance while preserving original diagnostics. |
| Agent-requested all-tabs guidance | Automated | A denied target creation publishes an Extension action; Chrome permission acquisition still requires the user's click. |

Daily-Chrome verification of provider warm-up, lazy history, draft-first send, active-tab restoration, related-tab inheritance, project selection, page comments, clipboard image input, automatic Agent approval, authorization isolation, and narrow and wide layouts passed on 2026-07-30.

OpenCode 1.18.12 was added after that retained daily-Chrome run. Its real ACP runtime is covered separately, but its user-configured browser-tool path remains `Forwarded` until the same shared-Bridge Chrome matrix is rerun with OpenCode selected; the established agent-browser 0.33.0 classification is unchanged.

## Stable distribution boundaries

- The Extension, protocol, browser registry, administration CLI, Provider, Bridge, and setup package are one lockstep compatibility unit; different Panerelay versions do not negotiate with each other.
- Candidate validation packs all seven npm packages, installs them outside the workspace, and runs browser administration, setup, doctor, update, and uninstall in disposable user state.
- Native Messaging setup supports macOS, Linux, and current-user Windows Chrome registration.
- Installing the candidate does not grant Chrome site permission, authorize a tab, or acquire a control lease.
- Packaging does not change participant isolation, target serialization, or Chrome authorization boundaries recorded above.

## Release automation evidence

The `0.1.0` stable workflow passed candidate preparation, exact npm publication, and GitHub Release creation. The matching tag and Release target the prepared commit, and every package in that release exposes the same version through npm tag `latest`. The current development candidate expands the lockstep publishable set to seven packages; its publication evidence begins with the next release.

The workflow-built beta Extension archive was loaded in daily Chrome and passed displayed beta identity, authorization, revocation, and cleanup acceptance. Prepare Release generated a reviewed version pull request without package, tag, Release, or Store side effects before merge.

The stable Extension was subsequently published under official Chrome Web Store ID `panplnkjlkoceaonlmpdekjphgmbggmi`, and the maintainer confirmed the published installation and browser behavior passed verification.
