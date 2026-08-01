# Spike 0006: Browser Use 0.13.7 through the Panerelay virtual CDP

- Status: Generic virtual-CDP prerequisites implemented and verified
- OpenSpec change: `add-browser-use-connection-adapter`
- RFC: [RFC-0007](../rfcs/0007-browser-use-connection-adapter-and-cdp-bootstrap.md)
- Recorded: 2026-07-31
- Follow-up capability probe: 2026-08-01

## Question

Can the released Browser Use CLI and its Browser Harness daemon use Panerelay's existing browser-level virtual CDP without an upstream patch, while preserving explicit target authorization, honest unsupported-method errors, persistent daemon reuse, revocation, and bounded cleanup?

The product bootstrap and adapter did not exist during the original architecture-gate run. The trace runner therefore allocates a normal current Panerelay `/sessions` participant and places a temporary loopback `/json/version` plus WebSocket tracing proxy in front of that participant. This tests Browser Harness's real HTTP bootstrap and CDP behavior without treating the temporary proxy as product code. Later sections distinguish the subsequent product implementation and release-candidate acceptance from that original spike path.

## Pinned baseline

| Component | Released version | Source revision | Evidence |
| --- | --- | --- | --- |
| Browser Use | `0.13.7` | `f0aa3a8bb03779c71a5aa262d389e3bfe6b77cdc` | The `0.13.7` tag and upstream `main` resolved to this revision on 2026-07-31. Its `pyproject.toml` pins `browser-harness==0.1.8`. |
| Browser Harness | `0.1.8` | `dbe6f8f22ba65170e2d4b8f17754c704d008fe49` | The `v0.1.8` tag and upstream `main` resolved to this revision on 2026-07-31. |
| agent-browser regression baseline | `0.33.0` | Published package | Existing Panerelay compatibility and regression baseline; it is not used to implement Browser Use behavior. |
| Panerelay | `0.2.0` development tree | `3c2f586b67c39857e80228d0fd1bdc6844587d9a` plus this uncommitted spike | Current relay under test. |
| Google Chrome | `150.0.7871.187` | Installed daily browser | Representative real Chromium runtime. |
| Google Chrome follow-up | `151.0.7922.72` | Installed daily browser | Reproduced the relay Input gap and verified the focus-emulation resolution. |
| Chrome for Testing | `148.0.7778.96` | Isolated unpacked-extension runtime | Verified raw `chrome.debugger` Input and OOPIF child-session capabilities without Panerelay product code. |
| Microsoft Edge | `150.0.4078.105` | Installed daily browser | Version recorded for later forwarded coverage; this spike is Chrome-first. |
| Python | `3.12.13` | Temporary `uv` environment | Runs the pinned released Python packages. |
| Node.js / pnpm | `20.19.5` / `10.34.5` | Workspace tools | Runs Panerelay and the bounded fixture/trace tooling. |
| macOS | `26.5.2` (`25F84`) | Test host | Current real-browser host. |

The isolated Python environment reported:

```text
browser-use 0.13.7
browser-harness 0.1.8
cdp-use 1.4.5
```

The user's existing Browser Use environment was not upgraded or modified. Neither upstream repository was patched, vendored, or installed from a checkout.

## Reproduction setup

Create an isolated released-package environment outside the repository:

```bash
SPIKE_DIR="$(mktemp -d /tmp/panerelay-browser-use-spike.XXXXXX)"
uv venv --python 3.12 "$SPIKE_DIR/venv"
uv pip install --python "$SPIKE_DIR/venv/bin/python" "browser-use==0.13.7"
"$SPIKE_DIR/venv/bin/python" -c \
  "import importlib.metadata as m; print(m.version('browser-use'), m.version('browser-harness'))"
```

Run the checked-in fixture:

```bash
node docs/spikes/fixtures/browser-use-0.13.7/server.mjs
```

The primary origin is `http://127.0.0.1:41741/`; the bounded cross-origin frame and authorization-boundary page use `http://127.0.0.1:41742/`. A true cross-site OOPIF fixture uses `http://localhost:41743/` and binds to IPv6 loopback. Override the ports with `PANERELAY_BROWSER_USE_FIXTURE_PORT`, `PANERELAY_BROWSER_USE_CROSS_ORIGIN_PORT`, and `PANERELAY_BROWSER_USE_CROSS_SITE_PORT`.

All browser mutations in this spike must stay on these origins. Generated traces, Browser Harness runtime files, daemon logs, screenshots, downloads, and credentials stay outside the repository and are removed after the run.

Capture the initialization trace with the exact temporary Python environment:

```bash
PANERELAY_BROWSER_USE_PYTHON="$SPIKE_DIR/venv/bin/python" \
node docs/spikes/run-browser-use-cdp-trace.mjs
```

The runner refuses an evidence directory inside the repository, verifies both pinned package versions, uses the current deterministic Panerelay browser selection, allocates a bounded spike participant, and exposes a temporary loopback `/json/version` proxy. It records only sanitized protocol structure, performs Browser Harness's public scoped reload, releases the participant, and removes its runtime and temporary directories.

Run the complete fixture, daemon-reuse, simultaneous-invocation, and revocation probe with:

```bash
PANERELAY_BROWSER_USE_PYTHON="$SPIKE_DIR/venv/bin/python" \
PANERELAY_BROWSER_USE_SCENARIO=fixture \
node docs/spikes/run-browser-use-cdp-trace.mjs
```

The runner intentionally allows `Partial` and `Unsupported` compatibility classifications, but exits non-zero for a failed probe, unexpected success across a policy boundary, cleanup failure, or trace truncation.

## Current Chrome remote debugging comparator

Chrome's current documented behavior matters only to the Direct comparator, not to the implemented Extension-backed connection. Since Chrome 136, `--remote-debugging-port` and `--remote-debugging-pipe` are ignored for the default Chrome data directory; debugging regular Chrome requires a non-standard `--user-data-dir`. See [Chrome's remote debugging switch change](https://developer.chrome.com/blog/remote-debugging-port).

The comparator started installed Chrome `150.0.7871.187` with an isolated temporary user-data directory and `--remote-debugging-port=0`. Browser Harness connected through the emitted DevTools port. The temporary Chrome profile, daemon, and runtime were removed after each run; the user's daily Chrome was neither restarted nor placed in remote-debugging mode.

## Upstream connection and daemon facts

Source inspection of the pinned Browser Harness release establishes:

- `BU_CDP_WS` has first priority; `BU_CDP_URL` is second; local Chrome discovery is the fallback.
- `BU_CDP_URL` is normalized as an HTTP DevTools base and resolved through `<base>/json/version`, with a bounded retry window.
- `BU_NAME` identifies one daemon lane.
- `BH_RUNTIME_DIR` can isolate one daemon endpoint; `BH_RUNTIME_DIR_SHARED=0` avoids a name-derived shared path.
- the daemon detaches from the invoking terminal (`start_new_session=True` on POSIX);
- `ensure_daemon()` reuses a healthy daemon before considering replacement environment;
- health includes the daemon IPC response and its self-reported CDP browser connection;
- `restart_daemon()` is a scoped stop operation; the next invocation starts a replacement.

These are upstream implementation facts for the pinned version, not a permanent compatibility promise.

## Browser-level initialization trace

The real released Browser Harness initialization passed through the current Panerelay relay without an upstream patch. The sanitized reusable trace is [browser-use-0.13.7-initialization-trace.json](./browser-use-0.13.7-initialization-trace.json).

The observed order was:

1. Browser Harness requested `GET /json/version` once and opened the returned browser WebSocket.
2. It sent browser-level `Target.getTargets`.
3. It selected one returned `page` target and sent `Target.attachToTarget` with `flatten: true`.
4. On the returned virtual page session it sent `Page.enable`, `DOM.enable`, `Runtime.enable`, and `Network.enable` concurrently.
5. Panerelay returned the four command results on that page session and forwarded `Runtime.executionContextCreated`, `Page.frameResized`, and later page/network events with the same virtual session routing.

`Browser.getVersion` was not part of Browser Harness 0.1.8 initialization. The Browser Harness daemon removes the session only for its internal `Target.*` helpers; a raw `cdp("Browser.*")` helper call carries the current page session. Panerelay still rejects browser-process ownership explicitly.

## Behavior matrix

Status meanings follow RFC-0007: `Verified` means the released helper and resulting fixture state passed; `Forwarded` means the command reached the authorized page with the expected response but lacks full state coverage; `Partial` records a usable subset plus a material gap; `Unsupported` is an explicit fail-closed boundary.

| Capability | Result | Evidence / boundary |
| --- | --- | --- |
| `/json/version` bootstrap | Verified | The first daemon start made one request. A healthy reused daemon ignored a different `BU_CDP_URL`. |
| Browser-level initialization | Verified | `Target.getTargets` → flattened attach → four page-domain enables and routed events passed. |
| Page reads and JavaScript | Verified | Page info, document readiness, DOM values, and fixture assertions passed on the selected target. |
| Form interaction | Verified | The original relay reproduced 55 successful `Input.dispatchKeyEvent` calls with zero key events and coordinate mouse success with zero page events. The implemented target-scoped focus-emulation setup made the unmodified Browser Harness key and mouse helpers produce the expected key, mouse, click, and submit events. |
| Direct-CDP form comparator | Verified | The same Browser Harness version, fixture, `fill_input()`, coordinate click, and submit assertion passed once against isolated Chrome 150 Direct CDP. |
| Navigation and waits | Verified | Fixture navigation, load wait, resulting URL, and DOM state passed. |
| Tab create/select/close | Verified | A background target was created, attached, selected logically, navigated, and closed. |
| Popup lineage | Verified | The probe first proved no matching popup existed, generated a page click event, discovered the resulting popup, selected it, read it, and closed it. |
| Same-origin iframe | Verified | The main page session read the same-origin frame document. |
| Cross-origin iframe helper | Verified | Against the true `127.0.0.1` to `localhost` OOPIF fixture, the implemented Bridge inventory exposed a participant-local iframe target and Browser Harness's unchanged `iframe_target()` plus target-scoped `js()` helper passed. |
| Screenshot | Verified | `Page.captureScreenshot` produced a non-empty temporary artifact that the runner removed. |
| Upload | Verified | `DOM.setFileInputFiles` produced the expected fixture-local file metadata. |
| Download behavior | Unsupported | `Browser.setDownloadBehavior` failed with the explicit browser-process ownership boundary. |
| Browser context | Unsupported | `Target.createBrowserContext` failed with CDP `-32601`; Panerelay does not synthesize an isolated context in the daily profile. |
| Whole-profile cookies | Unsupported | `Storage.getCookies` failed with the explicit whole-profile boundary. |
| Close daily Chrome | Unsupported | `Browser.close` failed explicitly and did not affect Chrome. |
| Sequential process reuse | Verified | A second process used the existing daemon, participant, and WebSocket; its invalid replacement URL was not requested. |
| Simultaneous processes | Verified, shared | Two processes completed through one daemon. This proves upstream sharing, not Agent isolation; both use the same current page/session state. |
| Participant revocation | Verified | Authenticated participant deletion returned 204, closed the relay WebSocket, and the next Browser Use command failed. It attempted a new `/json/version`, proving the old daemon was considered unhealthy. |
| Scoped reload | Verified | Public `browser-use --reload` stopped only the named private daemon lane. |
| Stale-daemon recovery | Verified upstream | Against two isolated Chrome Direct-CDP generations, the healthy daemon ignored a bad replacement URL; after the first browser exited, the next process detected the stale daemon and connected to the second URL without private IPC inspection. |
| Actual Native Host generation replacement | Verified in product follow-up | The original architecture-gate spike left this partial. Release-candidate acceptance later terminated the exact registered Native Host, rejected old generation material, proved the stale daemon had no control channel, and recovered through a fresh ticket and replacement Browser Harness PID. |

## Follow-up Extension capability probe

The checked-in `chrome-debugger-capabilities` MV3 fixture isolates Chrome's Extension API from the Bridge and Browser Harness daemon. Against Chrome for Testing `148.0.7778.96`, the exact Browser Harness key parameters and coordinate mouse parameters passed in all of these cases:

- an active tab in a focused window;
- an inactive tab in an unfocused window;
- no status-marker script, one marker injection, and a marker injection before every forwarded command;
- focus emulation absent and explicitly enabled.

With the loopback fixture server running, load the probe into an isolated Chrome for Testing build that still supports unpacked command-line extensions:

```bash
PROFILE_DIR="$(mktemp -d /tmp/panerelay-chrome-debugger-probe.XXXXXX)"
"$CHROME_FOR_TESTING" \
  --user-data-dir="$PROFILE_DIR" \
  --site-per-process \
  --disable-extensions-except="$PWD/docs/spikes/fixtures/chrome-debugger-capabilities" \
  --load-extension="$PWD/docs/spikes/fixtures/chrome-debugger-capabilities" \
  about:blank
curl http://127.0.0.1:41741/api/chrome-debugger-result
```

The Extension runs once on installation, posts only bounded counters, booleans, target types, fixture URLs, and protocol errors to the loopback fixture, then detaches and removes its probe tabs. The temporary browser profile is not reusable evidence and must be removed after inspection.

Each passing key run produced 19 `keydown`, 17 `keypress`, 19 `keyup`, and 17 `input` events. Each coordinate click produced `mousedown`, `mouseup`, `click`, and `submit`, and the fixture value and submitted state matched. This rules out an inherent `chrome.debugger` Input limitation, background-tab limitation, and controlled-favicon interleaving as the cause.

The same probe used strict site isolation with a `127.0.0.1` top page and `localhost` iframe. Direct `Target.getTargets` on a tab debuggee returned CDP `-32000 Not allowed`, so an Extension cannot obtain browser-wide inventory that way. Page-scoped `Target.setAutoAttach({autoAttach:true,waitForDebuggerOnStart:false,flatten:true,filter:[{type:"iframe",exclude:false}]})` succeeded, emitted `Target.attachedToTarget`, and a subsequent `Runtime.evaluate` using the child `sessionId` read the completed cross-site iframe document.

Chrome for Testing `151.0.7922.71` ignored the unpacked `--load-extension` launch argument in this environment, so no standalone Extension result is claimed for that binary. The installed Panerelay Extension in daily Chrome `151.0.7922.72` supplied the version-matched relay evidence below.

## Input compatibility resolution

The virtual-CDP form result is not a generic Browser Harness or fixture failure:

- the Direct-CDP comparator passed with the same released Browser Harness code and Chrome binary;
- `Runtime.evaluate` confirmed the target document had focus and the input was the active element;
- every `Input.dispatchKeyEvent` received an empty success result, while capture listeners observed no `keydown`, `keypress`, or `keyup`;
- `Input.insertText` changed the value, showing that the page session and Input domain were not wholly unavailable;
- the submit button's center resolved back to that button with `document.elementFromPoint`, yet two press/release pairs generated no mouse or submit event;
- a later coordinate click on the popup button did generate a click event and fresh popup, so the failure is not honestly classifiable as a blanket “Input unsupported” error.

The daily-Chrome follow-up reproduced the initial result, then tested two generic CDP session settings before retrying the unchanged Browser Harness helper. `Input.setIgnoreInputEvents({ignore:false})` did not change the result. `Emulation.setFocusEmulationEnabled({enabled:true})` made the next `fill_input()` and coordinate click pass: the document observed 19 `keydown`, 17 `keypress`, 19 `keyup`, 17 key-generated `input` events, `mousedown`, `mouseup`, `click`, and `submit`, and the final value matched.

This resolves the Input architecture gate without Browser Use-specific command rewriting or JavaScript input emulation. Panerelay now applies focus emulation as generic target setup, serialized before the first forwarded `Input.*` command for that target/debugger generation. The setup does not authorize, select, or foreground a tab. Each participant that uses Input holds a target-scoped claim; Panerelay disables emulation after the last such claim leaves if another observer keeps the physical debugger attached, while target detach and the normal authorization, Extension, and Native Host boundaries clear the state.

## OOPIF compatibility resolution

Browser Harness 0.1.8 does not request page-scoped auto-attach. Its `iframe_target()` helper instead polls browser-level `Target.getTargets`, selects a target whose type is `iframe`, and later calls flattened `Target.attachToTarget`. The Extension probe establishes that Chrome supplies the underlying capability through auto-attached child sessions, but deliberately rejects browser-wide inventory on the tab debuggee.

The implemented no-upstream-change solution is a generic Bridge virtualization:

1. enable non-pausing flattened iframe auto-attach on each physically attached authorized top-level target, recursively for nested OOPIF children;
2. map each Chrome child target/session into owning-target-scoped opaque Bridge state;
3. include participant-local virtual iframe targets in synthesized `Target.getTargets` results;
4. translate flattened `Target.attachToTarget` for a virtual iframe target into a participant-local session backed by the already auto-attached Chrome child session;
5. translate child events and later commands through that mapping and invalidate it on child detach, target detach, participant close, authorization loss, Extension disconnect, or Native Host shutdown.

This remains inside the virtual-CDP connection layer. It does not infer iframe automation semantics, widen the top-level authorized inventory, expose raw Chrome identifiers, pause child startup, or require a Browser Use change.

## Implementation verification

The implementation follow-up ran the pinned released Browser Use 0.13.7 and Browser Harness 0.1.8 against the rebuilt Native Host in daily Chrome without enabling Remote Debugging or changing either upstream package. The bounded fixture reported `Verified` for form interaction and the true cross-site OOPIF helper, as well as navigation, tabs, popup, same-origin frames, screenshot, and upload. Browser-process download behavior, isolated contexts, and whole-profile cookies continued to fail explicitly as `Unsupported`.

The same run passed healthy daemon reuse, simultaneous shared-daemon invocation, participant revocation, scoped daemon reload, bounded cleanup, and trace-redaction checks. Bridge tests cover target serialization, focus-claim cleanup, recursive non-pausing auto-attach, participant-local child target/session identifiers, cross-participant rejection, child command/event translation, and detach invalidation. The agent-browser 0.33.0 baseline snapshot, title, evaluation, and cleanup scenario also passed after the shared relay changes. Generated traces and runtime artifacts remained outside the repository and were removed after verification.

Release-candidate acceptance then exercised the setup-installed private CLI, registered adapter, authenticated product bootstrap, persistent Browser Harness lane, additive Skill contract, and CLI MCP launcher against Browser Use 0.13.7 / Browser Harness 0.1.8. Single-tab acceptance covered passive observation, unchanged keyboard and coordinate mouse helpers, same-origin navigation, screenshot, exact-origin loss, visible actor/activity, and immediate user release. Cross-origin navigation and user release both closed the participant WebSocket while leaving the detached daemon process alive without a TCP control channel. All-tabs acceptance covered existing targets, background creation, logical selection without foreground theft, close, controlled popup lineage, same-origin and OOPIF helpers, and exclusion of a fixture opened later in an independent Chrome window.

The cross-origin run exposed one Panerelay Extension lifecycle bug: the tab update handler cleared `authorizationMode` before deciding whether to release the single-tab lease, so it detached the target but initially left the participant WebSocket connected. The implementation now snapshots the authorization mode at update entry and releases the whole lease; Extension regression tests and the repeated daily-Chrome run prove the corrected boundary.

## Daemon and lifecycle conclusions

- A stable Panerelay daemon name plus private `BH_RUNTIME_DIR` is sufficient to isolate Extension mode from Browser Use's normal Direct lane.
- A fresh adapter ticket on every CLI invocation is still correct: a healthy daemon ignores it, while a stale daemon uses the current process environment after health failure.
- Unused tickets must allocate no participant and expire independently.
- Simultaneous Browser Use processes do not require separate WebSockets, but they share mutable daemon state. The implemented Panerelay CLI lock prevents simultaneous canonical runs and fails a contender busy after its bounded wait; it cannot claim isolation between sequential Agent calls.
- Participant/WebSocket authority can follow Native Host and relay lifetime even though the detached daemon process remains alive. A stale process has no browser control and recovers on the next invocation through public behavior.
- Normal task completion does not infer cleanup. User release, authorization loss, WebSocket/heartbeat failure, Extension disconnect, Native Host shutdown, scoped reload, and uninstall remain lifecycle boundaries.

## Security and evidence handling

The trace runner records protocol structure only. Opaque target, session, frame, request, context, node, script, and loader identifiers are remapped. URL hosts, string values, key characters, headers, cookies, bodies, timestamps, and binary data are redacted. It records output byte counts rather than subprocess output.

No Bridge bearer, participant credential, WebSocket URL, page content, cookie value, prompt, screenshot, request body, or raw CDP payload is retained in the repository. Generated evidence stays outside the repository during inspection; fixture screenshots, Browser Harness runtime state, and daemon temporary files are removed by the runner.

## Architecture-gate decision

The adapter/bootstrap architecture remains viable without a Browser Use upstream change, and initialization, lifecycle, revocation, tabs, navigation, screenshot, and upload behavior are strong positive evidence.

The adapter/bootstrap architecture is now **go with generic virtual-CDP prerequisites**. The follow-up established concrete Extension-backed solutions for both blockers while leaving Browser Use and Browser Harness unchanged.

The development candidate is now compatible with the pinned Browser Use CLI, additive Panerelay Skill, and Browser Harness-backed CLI MCP surfaces. It implements the generic focus-emulation and participant-local OOPIF inventory prerequisites, authenticated lazy bootstrap, private persistent lane, setup integration, and explicit ownership failures without modifying Browser Use upstream. Browser Use-specific command rewriting, JavaScript input emulation, an upstream fork, raw Chrome child identifiers, silent success, and arbitrary Python SDK transparency remain out of scope. This conclusion is release-candidate evidence, not a claim that RFC-0007 is Implemented or that the package has been published.
