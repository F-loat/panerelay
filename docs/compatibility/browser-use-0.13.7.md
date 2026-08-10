# Browser Use 0.13.7 compatibility

- Panerelay release: current development candidate
- Browser Use: 0.13.7
- Browser Harness: 0.1.8
- Chrome: 151.0.7922.72, existing daily profile
- agent-browser regression baseline: 0.33.0
- Last verified: 2026-08-06
- Last updated: 2026-08-06

This record covers the setup-managed Panerelay connection adapter, the fixed Browser Harness environment default consumed by the official Browser Use CLI and CLI MCP, and the Browser Use workflow in the independently installed unified `panerelay` Skill. It does not claim transparent interception of arbitrary Browser Use Python SDK construction or the official Browser Use Skill.

This is exact evidence for Browser Use 0.13.7 and its Browser Harness 0.1.8 runtime, not a claim about every later release. Panerelay's user-facing compatibility floor is Browser Use 0.13.7; setup and doctor also verify the completeness of its internal runtime, but present one Browser Use check. A newer stable installation that passes the minimum gate is eligible to run and is not automatically classified as Verified by this record.

## Status meanings

- **Verified**: deterministic coverage and a representative daily-Chrome run passed through the authenticated product bootstrap.
- **Automated**: deterministic contract or packaging coverage passed; a dedicated daily-Chrome action is still pending.
- **Forwarded**: the operation uses a verified virtual-CDP path, but this exact surface has not completed dedicated acceptance.
- **Partial**: a supported subset passed and a material boundary remains.
- **Unsupported**: Panerelay rejects the operation explicitly because the Extension-backed connection cannot provide the required ownership or isolation.
- **Pending**: the release acceptance action still requires a user-visible authorization or revocation step.

## Connection surfaces

| Surface | Status | Evidence and boundary |
| --- | --- | --- |
| Official Browser Use CLI | Verified | The official executable read the setup-managed `BU_CDP_URL`, reached Browser Harness `/json/version`, and completed the single virtual-CDP WebSocket without Chrome Remote Debugging. |
| Browser Use workflow in the unified Panerelay Skill | Verified | The independently managed Skill does not replace the official Browser Use Skill; its commands use the same official CLI and setup-managed environment. |
| Browser Use CLI MCP | Verified | The official `browser-use --cli-mcp` read the same managed environment. A standard MCP client initialized the server, observed exactly `browser_exec` and `browser_screenshot`, and completed a fixture read without warmup output contaminating JSON-RPC stdout. |
| Direct one-run override | Automated | Adapter/CLI tests prove Direct mode creates no ticket and injects no Panerelay connection state. Direct Chrome behavior remains Browser Use-owned. |
| Arbitrary Python SDK construction | Unsupported | Applications must explicitly pass connection material themselves; Panerelay does not monkeypatch or transparently intercept `BrowserSession`/`Agent` construction. |

## Runtime behavior

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| Authenticated HTTP bootstrap | Verified | Ticket allocation creates no participant; `/json/version` lazily creates one; the first WebSocket consumes its credential; later healthy-daemon resolves leave only expiring unused tickets. |
| Browser Harness initialization | Verified | Target discovery, flattened attach, page-domain enablement, routed events, `list_tabs()`, `switch_tab()`, and `page_info()` passed through the product endpoint. |
| Side Panel conversation target selection | Automated | Context and Skill tests inject the Extension-generated opaque target UUID into the unchanged `switch_tab(targetId)` helper on the existing `BU_NAME=panerelay` lane, require `page_info()` verification, and prohibit URL/title matching, a second daemon, engine switching, or Direct fallback. A dedicated injected-context daily-Chrome run is still pending. |
| Reads and JavaScript | Verified | Fixture title, URL, DOM state, and JavaScript evaluation passed. |
| Keyboard and coordinate mouse | Verified | Unchanged `fill_input()` and `click_at_xy()` produced the expected fixture value and submit state. The generic relay enables target-scoped focus emulation before the first `Input.*` command without foregrounding Chrome. |
| Navigation, waits, and screenshot | Verified | Same-origin navigation/load and a non-empty screenshot artifact passed; the temporary artifact is removed after acceptance. |
| Existing tabs, create, logical select, and close | Verified | All-tabs discovery, inactive target creation, Browser Harness logical selection, and close passed while the physical Chrome active-tab ID remained unchanged. |
| Popup lineage | Verified | A popup created by the controlled fixture was discovered once, selected, read, and closed. |
| Same-origin iframe | Verified | The top-level session read the same-origin frame document. |
| Cross-site iframe helper | Verified | A true `127.0.0.1` to `localhost` OOPIF appeared as a participant-local virtual iframe target; unchanged `iframe_target()` and target-scoped `js()` passed. |
| Single-tab cross-origin revocation | Verified | With exactly one fixture target authorized, navigation from `127.0.0.1:41741` to `127.0.0.1:41742` made the next Browser Harness operation fail, closed the participant WebSocket, and left the detached daemon with no TCP control channel. Acceptance found and fixed an Extension state-transition bug that previously detached only the target after clearing the single-tab mode; the regression is covered by Extension tests. |
| User-visible actor and activity | Verified | While Browser Use continuously observed the authorized fixture, the side panel visibly identified `Browser Use acceptance` and showed ongoing activity. |
| Immediate user release | Verified | The user released the live lane from the side panel. The active Browser Harness command failed immediately rather than timing out, and the still-running daemon had no remaining TCP/CDP connection. Deterministic Extension coverage and a daily-Chrome settings run verify the revised UI boundary: release preserves the selected current-tab or all-tabs scope, while clearing that scope is a separate explicit toggle action. |
| Independently opened target exclusion | Verified | After the participant initialized with five exposed targets, the user opened the fixture in a new Chrome window. A continuously polled and then freshly read target inventory remained at five, added no target ID, and did not expose the marker URL. Chrome-reported descendants of controlled tabs remain intentionally eligible. |
| Sequential process reuse | Verified, shared | Separate CLI processes reused one Browser Harness PID, participant, and established TCP/WebSocket. The second process observed the first process's current-tab state, so this is explicitly not per-Agent task isolation. |
| Simultaneous invocation | Verified | One CLI process held the user-scoped lane; the other failed within the bounded wait with an explicit busy message. |
| Native Host generation replacement | Verified | Terminating the exact registered Native Host invalidated an old ticket and disconnected the stale daemon. The next CLI invocation replaced the stale Browser Harness PID and recovered through a fresh generation/ticket. |
| Participant-scoped control claim cleanup | Verified | Browser Use control claims are ordered independently from Playwright and agent-browser references. Deterministic coverage verifies recency refresh, fallback, last-claim downgrade, and no forced debugger detach. In updated daily Chrome, Browser Use opened and retained Bing while Playwright temporarily became the newest claimant across the authorized inventory; Playwright detach restored the Browser Use mark and a following `page_info()` succeeded without reconnecting. Edge remains `Forwarded`. |
| Browser-process methods | Unsupported | `Browser.setDownloadBehavior` and `Browser.close` fail with an explicit browser-process ownership error. |
| Isolated browser context | Unsupported | `Target.createBrowserContext` fails explicitly; normal daily-Chrome windows are not represented as isolated contexts. |
| Top-level request containment | Unsupported | Pausing auto-attach with `waitForDebuggerOnStart=true` fails explicitly; Extension attachment does not claim pre-request containment. |
| Whole-profile data | Unsupported | `Storage.getCookies` fails with the explicit daily-profile boundary. |

## Privacy and local artifacts

The integration overrides Browser Harness and Browser Use telemetry for this lane with `BH_TELEMETRY=0` and `ANONYMIZED_TELEMETRY=false`, and disables automatic recording with `BH_RECORD=0`. It intentionally leaves Browser Harness's runtime and temporary-directory defaults unchanged because Browser Harness 0.1.8 initializes its client IPC paths before loading the workspace `.env`; overriding those paths from `.env` can make the client and daemon resolve different sockets. The WebSocket credential is consumed at the first successful handshake and cannot be reused. Panerelay itself does not log Bridge bearers, tickets, WebSocket URLs, raw CDP bodies, page content, cookies, screenshots, prompts, or request bodies by default.

The final acceptance scan found real connection material only in Browser Harness's protected user-scoped daemon log and one pre-isolation legacy daemon log. No Bridge bearer, ticket, or WebSocket credential appeared in adapter, CLI, Bridge, setup/test output, or the repository. The WebSocket credential is consumed by the participant handshake; Panerelay does not remove Browser Harness's default runtime or log paths during uninstall.

## Regression boundary

The existing agent-browser path remains separate: it still creates authenticated multi-connection participants through `/sessions`. Provider contract tests, the full Bridge relay suite, and a daily-Chrome agent-browser 0.33.0 fixture baseline passed after the Browser Use bootstrap and single-connection policy were added. The 2026-08-06 coexistence regression combines deterministic three-participant coverage with the updated 0.8.0 Extension in daily Chrome: agent-browser, Browser Use, and Playwright remained live together; Playwright detach restored the remaining per-engine presentation; and Browser Use continued reading its selected Bing page afterward.
