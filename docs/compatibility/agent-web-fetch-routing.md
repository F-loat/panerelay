# Agent browser-fetch routing compatibility

- Panerelay release: current development candidate
- Codex CLI observed: 0.144.6
- Claude Code baseline: 2.1.206 or newer
- Last updated: 2026-08-10

## Status meanings

- **Verified**: deterministic implementation evidence plus a real supported configuration/runtime probe where applicable.
- **Forwarded**: Panerelay uses a documented vendor surface, but no signed-in model turn has exercised the complete route.
- **Partial**: the primary route exists with an explicit limitation.
- **Unsupported**: Panerelay does not claim transparent replacement through the available supported surface.

## Matrix

| Surface | Status | Evidence and boundary |
| --- | --- | --- |
| Fetch MCP protocol and lifecycle | Verified | Bridge tests cover initialize, list, call, invalid input, permission denial, concurrent cancellation, bounded output, and exact session release. A bundled Native Host stdio smoke probe returned the declared `browser_fetch` tool. |
| MCP to daily Chrome request | Verified | A real stdio `browser_fetch` call through the installed stable launcher, Browser Registry, Bridge, and a reloaded matching daily Chrome Extension returned a successful HTTP response. Only status-level evidence was retained. |
| Panerelay-owned Codex configuration | Verified | Provider tests pass process-local config overrides before `app-server`; an installed Codex 0.144.6 probe accepted `tools.web_search=false` and listed `panerelay_fetch` with the current bundled command. A signed-in model turn is not required for configuration verification. |
| Panerelay-owned Codex model routing | Forwarded | The MCP tool and developer guidance are available and hosted web search is disabled, but model tool selection remains Codex-owned and no live turn is retained as evidence. |
| External Codex setup | Automated | Explicit `--codex-fetch` setup writes one marked MCP block and a managed `tools.web_search=false`, detects reserved-name conflicts, reports status, restores the previous value, and removes only unchanged owned content. Base setup does not edit Codex configuration. |
| Codex transparent Hook interception | Unsupported | Hosted WebSearch does not invoke Codex Hooks. Panerelay uses supported process/config overrides and MCP registration instead of pretending to replace a hosted tool result. |
| Panerelay-owned Claude configuration | Automated | Provider tests pass `panerelay_fetch` beside the approval MCP and generate a turn-scoped deny for `WebFetch` while preserving the other settings sources and `WebSearch`. |
| Panerelay-owned Claude model routing | Forwarded | No compatible signed-in `claude` executable is present in the verification environment. MCP use and denied native WebFetch remain vendor-controlled runtime behavior until a live turn is recorded. |
| External Claude setup | Automated | Explicit `--claude-fetch` setup adds one user MCP entry and one `permissions.deny` value, preserves unrelated JSON, detects reserved-name conflicts, diagnoses exact ownership, and removes only fields it added. Base setup does not edit Claude configuration. |
| Claude transparent Hook replacement | Unsupported | Hooks can inspect, rewrite, allow, or deny `WebFetch`, but cannot return an MCP tool result in place of the built-in call. Panerelay denies `WebFetch` and makes the MCP tool directly available. |
| Claude WebSearch | Unchanged | Search remains available because browser Fetch retrieves a known URL and is not a search engine. |
| Qoder/OpenCode automatic routing | Unsupported | Their Panerelay ACP providers retain existing tool/config ownership. Panerelay does not inject Fetch MCP or disable an unknown native fetch surface without a stable provider-supported boundary and version evidence. |

## Stable boundary

The MCP surface is a generic fetch-shaped HTTP(S) request tool, not browser automation and not search. Raw MCP calls receive one exact-origin session and no protected browser-state bindings. Applicable browser Cookies may be attached by the Extension; arbitrary Cookie names, `localStorage` keys, API keys, tab IDs, navigation, DOM, and control operations are not inputs. Redirects fail closed, and non-GET methods are conservatively treated as potentially mutating.

Protected exact-origin `localStorage` support belongs to installed site manifests, not generic MCP callers. This prevents a model or arbitrary child process from selecting browser secrets and destinations dynamically.

Persistent external-Agent changes are explicit and reversible. Setup does not patch vendor binaries, install hooks, proxy vendor traffic, modify model credentials, or claim that configuration alone guarantees model behavior.

## Vendor references

- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp)
- [Codex Hooks](https://learn.chatgpt.com/docs/hooks)
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code settings](https://code.claude.com/docs/en/settings)

## Required follow-up

1. Run one signed-in Panerelay-owned Codex turn and confirm authenticated URL retrieval selects `panerelay_fetch` without hosted WebSearch.
2. Run one signed-in Panerelay-owned Claude turn and confirm `WebFetch` is unavailable while `panerelay_fetch` and `WebSearch` remain available.
3. Repeat supported configuration and runtime evidence on Windows before upgrading Windows from Forwarded.

Do not retain prompts, request/response bodies, cookies, browser storage, MCP configuration paths, or browser identifiers in compatibility evidence.
