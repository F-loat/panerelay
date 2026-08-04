## Why

Side Panel conversations know the current page URL and title but do not carry a usable opaque browser target identity. URL/title matching is ambiguous, agent-browser and Playwright expose only session-local tab handles or indexes, and Browser Use can address an exact CDP target only when the Agent already knows its identifier. This makes otherwise authorized automation liable to start on the wrong tab.

## What Changes

- Add a bounded conversation target hint containing the originating browser's opaque registration ID and the Extension-generated opaque target ID; never expose a raw Chrome tab ID.
- Include engine-specific, copyable targeting guidance in the injected conversation context:
  - agent-browser 0.33.0: a derived `--session` name that the Panerelay Provider binds to the hinted browser and target before assigning session-local `t1`;
  - Browser Use 0.13.7 with Browser Harness 0.1.8: the existing Panerelay daemon lane plus the exact `switch_tab(targetId)` helper;
  - Playwright CLI 0.1.17: a derived `-s=<session>` name and a target-scoped explicit CDP attach URL whose initial tab index `0` is the hinted target.
- Resolve a target hint only within the originating live browser registration and the participant's already authorized target set. A missing, stale, closed, unauthorized, or wrong-browser target fails explicitly and never lets the documented local handle (`t1` or index `0`) silently select another tab.
- Preserve each engine's normal session, tab-list, tab-create, and automation behavior after the initial target is selected.
- Update RFC-0002 and RFC-0007, the unified browser Skill, pinned compatibility records, deterministic relay/provider tests, and real-engine probes.

Non-goals:

- The hint does not grant Chrome site permission, authorize a tab, acquire or renew a control lease, or infer authority from focus.
- Panerelay will not expose raw Chrome tab IDs, patch or fork any automation engine, translate normal automation commands, or create a provider-owned browser tool.
- A target hint is not durable across Extension target-ID loss, browser registration replacement, tab closure, or authorization revocation.
- Browser Use keeps its existing shared persistent Panerelay daemon lane; this change does not create one daemon per conversation or claim per-Agent isolation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sidepanel-agent-context`: New conversations receive a bounded opaque browser/target hint and engine-specific targeting instructions without receiving a raw Chrome tab ID or browser authority.
- `agent-browser-advanced-commands`: A Panerelay-derived agent-browser session can bind initial target discovery to one exact authorized target and fail closed when the hint is stale.
- `browser-use-connection-adapter`: Browser Use can consume the hinted opaque target through its native `switch_tab(targetId)` helper while retaining the shared persistent lane.
- `playwright-cdp-connection`: A target-scoped explicit attach route and CLI session make the hinted authorized target the initial Playwright index `0` or fail closed.
- `cdp-http-bootstrap`: Optional target hints are bound to bootstrap participants without broadening target exposure or authorization.
- `panerelay-browser-skill`: The Skill documents and validates the exact engine-specific session and target-selection commands.

## Impact

- Affected protocol and Extension code: conversation page context validation, active-tab context capture, and opaque target lifecycle.
- Affected Bridge and integration code: context rendering, agent-browser Provider selection, relay participant target hints, CDP bootstrap, and Playwright gateway URL parsing.
- Affected documentation: RFC-0002, RFC-0007, agent-browser 0.33.0, Browser Use 0.13.7/Browser Harness 0.1.8, Playwright CLI 0.1.17, and the unified `panerelay-browser` Skill.
- No external dependency is modified. Lockstep Panerelay packages gain additive protocol fields and must ship together under the existing distribution rule.
