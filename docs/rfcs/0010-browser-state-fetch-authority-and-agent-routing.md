# RFC-0010: Browser-state fetch authority and Agent routing

- RFC: 0010
- Title: Browser-state fetch authority and Agent routing
- Status: Accepted
- Authors: F-loat
- Created: 2026-08-09
- Updated: 2026-08-09
- OpenSpec: `openspec/changes/harden-browser-fetch-and-agent-routing`

## Summary

Panerelay browser fetch is a generic, bounded HTTP(S) request path that can reuse the selected browser's current login state without exporting browser credentials. Every raw request receives one exact-origin session. Every site adapter declares its complete origin set and optional protected browser-state bindings in its installed manifest. The Bridge and Extension independently enforce that authority.

The Extension may resolve an exact Cookie or one manifest-declared `localStorage` value and inject it into a fixed request destination. The value never reaches the caller, Bridge, adapter process, MCP process, logs, or normal errors. User-managed API keys, tokens, client secrets, credential profiles, arbitrary storage reads, and caller-selected binding definitions are not supported.

Panerelay also exposes this request path as one stdio MCP tool. Panerelay-owned Codex and Claude Code providers configure that tool for their child process and disable the vendor fetch surface that would otherwise bypass browser login state. Persistent external-Agent configuration is a separate explicit, reversible setup choice.

This RFC extends RFC-0001 and supersedes RFC-0009 where that RFC describes fetch protocols v1/v2, caller-defined Cookie bindings, redirect following, `credentials: "omit"`, or the absence of browser-storage support.

## Goals and non-goals

Goals:

- keep fetch useful as a general HTTP(S) request tool while bounding each caller's network authority;
- reuse browser Cookie and narrowly declared exact-origin `localStorage` login state without disclosing values;
- allow normal browser handling of unpartitioned `Set-Cookie` responses;
- route supported Agent fetch work through the same browser-authenticated path using documented configuration surfaces;
- preserve site permission, tab authorization, browser control, and fetch as separate capabilities.

Non-goals:

- redirects, page navigation, DOM extraction, JavaScript challenge execution, interactive login, or search-engine semantics;
- arbitrary `localStorage`, `sessionStorage`, IndexedDB, partitioned Cookie, or browser-profile access;
- user-supplied API keys, credential storage, OAuth refresh, or model credentials;
- patching, hooking, proxying, or impersonating vendor-hosted fetch/search implementations;
- changing agent-browser, Browser Use, Playwright, Qoder, or OpenCode automation semantics.

## Authority model

The lockstep fetch-session, adapter, and adapter-registry protocols use v3. A session carries canonical allowed origins and protected binding policies. Origins are exact `http[s]://host[:port]` values or leading-wildcard hosts with a fixed scheme and port. Paths, credentials, query strings, fragments, wildcard schemes, wildcard ports, wildcard IP addresses, and wildcard localhost are invalid.

Raw CLI and MCP calls receive one exact origin derived from their request URL and no protected bindings. Site-adapter sessions receive the origins and policies from the protected installed manifest, not from the adapter child. A child request contains only binding IDs. The Bridge rejects an undeclared origin, unknown binding ID, incompatible destination, expired session, changed browser generation, or revoked registration before Native Messaging. The Extension repeats the origin, binding, domain-grant, and Chrome Host Permission checks before reading browser state or starting network work.

Static adapters may declare no origins only when they make no fetch calls. An adapter may declare at most 32 origins and 16 binding policies. Existing v1/v2 artifacts are rejected; setup replaces the registry and all selected adapters together rather than implementing dual semantics.

## Redirect and Cookie behavior

Every Extension request uses `redirect: "error"`. `redirect: "manual"` produces an opaque redirect without a safely inspectable `Location`, while native following can send credentials to a second URL before Panerelay can authorize it. Adapters must use canonical final endpoints. Redirect-only behavior is Unsupported in this fetch boundary.

Fetch uses `credentials: "include"` so Chromium can apply ordinary unpartitioned `Set-Cookie` responses. An exact-URL, Extension-initiated DNR session rule still sets the selected outgoing Cookie header or removes it when `withCookies` is false. The rule also preserves explicit `Origin` and `Referer` behavior and is removed in `finally` and startup cleanup. `Set-Cookie` is never returned to callers. Partitioned Cookies are ignored because an Extension service-worker request has no truthful user-authorized top-level-site partition context.

## Protected browser-state bindings

A manifest binding fixes all of the following:

- a stable ID;
- an exact Cookie name or exact-origin `localStorage` key;
- optional Cookie URL decoding or bounded JSON Pointer fallbacks for storage;
- a form, top-level JSON, or non-reserved request-header destination;
- optional fixed prefix/suffix;
- the request origins on which the binding is valid;
- whether the value is required.

For `localStorage`, the source origin must also be part of the session authority and have a current Panerelay domain grant and Chrome Host Permission. The Extension considers only already-open tabs whose parsed URL has that exact origin, selects deterministically, and runs `localStorage.getItem` in that tab's isolated world. It does not open, focus, reload, or navigate a tab and does not create a control lease. Missing tabs, lifecycle races, inaccessible storage, malformed JSON, missing required pointers, and values outside the bounds fail before network work.

Resolved and transformed values must contain at least eight UTF-8 bytes and no more than 64 KiB. Bound responses must be textual or JSON. The Extension redacts every resolved representation from response headers, decoded bodies, and errors before crossing Native Messaging; binary bound responses fail closed. Query-string destinations remain forbidden because URLs are routinely retained in diagnostics and history.

## Agent Fetch MCP

The stable Native Host launcher accepts `--fetch-mcp` and runs a bounded line-delimited stdio MCP server instead of Native Messaging. It exposes one `browser_fetch` tool with fetch-shaped URL, method, header, query, body, Cookie, response-type, and timeout inputs. It exposes no browser-state selector, binding declaration, permission-grant mutation, tab, navigation, DOM, or browser-control input.

Each call selects one live fetch-capable browser through Browser Registry, asks the Extension for explicit domain approval when needed, creates one exact-origin fetch session, and releases that session in `finally`. Input, output, concurrency, cancellation, timeout, and diagnostic sizes are bounded. Cancellation aborts permission/fetch work and suppresses a successful result. Cookies, storage, registration credentials, and fetch-session credentials never enter MCP output.

The MCP annotation is conservative because HTTP methods may mutate server state. Agents should use GET or HEAD unless the user requested a mutation and should treat failed or interrupted mutations as having an unknown outcome.

## Vendor routing

Panerelay uses supported runtime configuration rather than interception:

- Panerelay-owned Codex app-server processes receive a process-local `panerelay_fetch` MCP definition and `tools.web_search=false` override. Codex hosted WebSearch does not invoke Codex Hooks, so Hooks cannot transparently replace it.
- Panerelay-owned Claude Code turns receive `panerelay_fetch` beside the existing approval MCP and a turn-scoped deny rule for `WebFetch`. Claude Hooks can inspect or deny WebFetch, but cannot replace that tool call with an MCP result. `WebSearch` remains available because Fetch MCP retrieves a known URL and is not a search engine.
- Qoder and OpenCode remain unchanged until their supported provider/configuration surfaces can disable only the bypassing fetch tool and inject MCP without altering user-owned configuration or ACP semantics.

Provider context instructs the model to use Panerelay Fetch MCP for browser-authenticated URL requests and an automation engine for DOM, navigation, or interaction. Configuration makes the desired path available and blocks the known bypass; it does not guarantee model tool selection or impersonate a vendor tool name.

External Codex or Claude Code configuration changes occur only with explicit setup flags. Setup writes one marked/structured MCP entry and the narrow native-tool disable, records only Panerelay-owned state under protected storage, refuses unmanaged reserved-name conflicts, and removes only unchanged owned fields. Base setup and interactive automation setup do not change external Agent configuration. Full Panerelay uninstall attempts the owned cleanup before removing the stable launcher.

## Security and privacy

1. Fetch remains loopback-only, browser/generation-bound, short-lived, concurrency-bounded, and independently authenticated.
2. A fetch session creates no CDP participant, tab authorization, focus change, activity lease, or browser-control ownership.
3. Domain permission and Chrome Host Permission remain mandatory and independently user-revocable.
4. Protected state values remain Extension-private and are never logged by default.
5. The caller cannot select a Cookie name, storage origin/key, JSON pointer, destination, prefix, or suffix at request time.
6. Raw fetch remains a request tool, not a credential manager. Panerelay does not solicit, persist, refresh, or distribute user-managed keys.
7. MCP domain approval is an explicit Extension user action and cannot grant all domains.
8. Persistent Agent integration is explicit and reversible; setup never patches a vendor executable or silently edits an unrelated tool configuration.

## Compatibility and migration

All affected components ship lockstep at protocol v3. Existing domain grants, Chrome Host Permissions, browser registrations, and automation authorization remain usable. Existing v1/v2 fetch registries and artifacts must be replaced; there is intentionally no compatibility reader.

Chrome is the live verification baseline. Edge inherits shared Chromium implementation only as Forwarded until equivalent evidence exists. Redirect following becomes Unsupported. Exact-origin `localStorage`, Cookie write-back, no-cookie removal, and Agent MCP routing may be upgraded only after their daily-browser/provider evidence is recorded in `docs/compatibility/`; the current evidence and classifications live there rather than in this RFC.

Persistent external Codex and Claude setup is optional. Removing it restores the prior Codex web-search setting and removes only the Panerelay MCP/Claude deny entry when those entries still match setup's ownership record.

## Alternatives considered

### Follow redirects and validate only the final URL

Rejected because credential-bearing intermediate requests have already occurred before the final URL is visible.

### Read storage through CDP or page navigation

Rejected because it would turn fetch into tab automation, require control authority, and broaden lifecycle and exfiltration risk.

### Expose arbitrary storage names to raw CLI or MCP callers

Rejected because the caller could turn browser storage into a general secret-reading and cross-origin injection surface.

### Parse `Set-Cookie` in the Extension

Rejected because a custom parser would diverge from Chromium's domain, path, SameSite, expiry, and partition semantics.

### Hook or proxy vendor WebFetch

Rejected because supported Codex/Claude hooks cannot replace hosted tool results, and a network proxy would be broader, brittle, and credential-sensitive. Supported MCP and native-tool configuration is the stable boundary.

## Acceptance criteria

1. Protocol, Bridge, CLI, site-kit, Extension, MCP, provider, and setup tests cover strict origin/binding validation, cancellation, lifecycle cleanup, ownership conflicts, and non-disclosure.
2. Every built-in site manifest declares literal origins and existing Cookie CSRF behavior uses protected binding IDs.
3. A local MV3 fixture records redirect opacity/rejection, outgoing no-cookie behavior, unpartitioned Cookie write-back, and exact-origin `localStorage` behavior without retaining credentials.
4. Isolated E2E covers each newly enabled or binding-migrated site and one MCP-to-reloaded-daily-Chrome request.
5. Compatibility records distinguish Verified, Forwarded, Partial, and Unsupported evidence and retain DOM/navigation limitations as Unsupported for the current site boundary.
6. Full workspace check, OpenSpec strict validation, and diff hygiene pass.

This RFC remains Accepted until the governed code and compatibility evidence ship in a release.
