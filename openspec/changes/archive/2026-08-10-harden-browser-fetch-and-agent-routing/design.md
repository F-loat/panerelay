## Context

See [proposal.md](proposal.md) for motivation. Browser fetch currently creates browser/generation-bound v2 sessions, lets adapters choose Cookie bindings per request, authorizes only the initial URL in the Extension, uses native redirect following for unbound requests, and fetches with `credentials: "omit"`. The Bridge already publishes a loopback relay through Browser Registry, and both the standalone CLI and future stdio MCP processes can use that authenticated relay without receiving browser state.

Codex app-server accepts process-level config overrides and MCP server definitions. Its hosted WebSearch tool does not fire Codex Hooks, so it cannot be intercepted. Claude Code accepts turn-scoped `--mcp-config` and settings, can deny `WebFetch`, and exposes MCP calls through its normal tool stream; its hooks can rewrite a WebFetch input but cannot replace the tool with an MCP result. RFC-0001 currently prohibits side-panel MCP injection and RFC-0009 does not authorize browser storage reads, so a new durable RFC amendment is required.

## Goals / Non-Goals

**Goals:**

- Make every fetch caller's network authority explicit, inspectable, protected from child-adapter mutation, and enforced in both local policy layers.
- Keep Cookie and localStorage values entirely inside the Extension while still supporting fixed request injection and safe response redaction.
- Give Panerelay-owned and explicitly configured external Agents one stable fetch-only MCP surface backed by the same relay, with conservative mutation annotations for non-GET methods.
- Preserve browser authorization, tab authorization, active control, and automation semantics as separate boundaries.

**Non-Goals:**

- Supporting redirects, partitioned Cookie emulation, sessionStorage, arbitrary storage reads, user-managed keys, page navigation, DOM extraction, search-engine behavior, or model-vendor runtime patching.
- Making the MCP fetch tool a general browser automation engine or changing the agent-browser 0.33.0, Browser Use 0.13.7/Browser Harness 0.1.8, or Playwright CLI 0.1.17 capability baselines.

## Decisions

### 1. Replace v2 sessions and per-request Cookie declarations with v3 authority metadata

The lockstep protocol moves to fetch-session and adapter v3. `FetchAdapterManifest` requires `origins` and may include `bindings`. A binding policy has a stable ID, a fixed Cookie or exact-origin localStorage source, a fixed form/JSON/header destination with optional fixed prefix/suffix, and request-origin patterns on which it may be used. Adapter requests contain only binding IDs.

The trusted CLI creates adapter sessions from the protected registry manifest. Raw CLI and MCP calls create a session for one exact request origin and no bindings. The Bridge stores normalized patterns and policies, rejects requests outside the session, resolves requested IDs, and sends the Extension only the policies selected for that request. The Extension repeats origin and policy checks before touching browser state.

This is preferred over inferring hosts from executable code or first requests because either inference lets untrusted child code define its own authority. It is preferred over carrying arbitrary localStorage keys in requests because the source and destination would then be an exfiltration primitive.

Origin patterns are canonical URL origins: exact `http[s]://host[:port]` or `http[s]://*.domain[:port]`. Wildcards match the registrable-looking root and subdomains, mirroring fetch-domain grants; wildcard hosts are rejected for localhost and IP literals. Paths, credentials, query, fragments, wildcard schemes, and wildcard ports are rejected.

### 2. Reject every redirect

All Extension fetches use `redirect: "error"`; `redirectMode` is removed from public input. Fetch manual mode returns an opaque-redirect response with no Location header, while native follow sends the next request before Panerelay can inspect or authorize it. A normal MV3 extension cannot synchronously authorize and block each redirect through `webRequest`, and a global DNR redirect guard would interfere with unrelated Extension traffic. Therefore fail-closed redirect rejection is the only bounded implementation that preserves the declared-origin and credential boundaries.

Adapters must call canonical final endpoints. Compatibility records distinguish this deliberate limitation from page navigation.

### 3. Resolve exact-origin localStorage in an already-open tab

The Extension queries existing tabs, filters parseable URLs by exact `URL.origin`, and chooses deterministically by most recent access and tab ID. It uses `chrome.scripting.executeScript` in that tab's isolated world to call `localStorage.getItem` for the manifest-declared key. Optional RFC 6901 JSON Pointer fallbacks are evaluated in the Extension, with the first non-empty string winning. Values are trimmed only when the policy requests it; no arbitrary script crosses the protocol.

The source origin must be in the session, currently fetch-domain-authorized, and covered by Chrome Host Permission. No tab-control authorization or lease is created because this is separately authorized, read-only storage access within the Extension fetch capability. Missing tabs, unavailable storage, malformed JSON, absent pointers, and oversized values fail before network traffic. This is preferred over opening a page, CDP, content-script message APIs, or returning storage to the adapter.

### 4. Enable browser Cookie persistence but keep explicit outgoing selection

Fetch uses `credentials: "include"` so Chrome can process applicable Set-Cookie responses. Before sending, the existing exact-URL DNR rule still sets the generated unpartitioned Cookie header or removes Cookie when disabled, so caller-visible behavior remains deterministic. Set-Cookie remains a forbidden response header and is never copied to results. `chrome.cookies.getAll({url})` results with `partitionKey` remain excluded; Panerelay has no honest user-authorized top-level-site partition key for a service-worker fetch.

A local MV3 spike and real Extension E2E must prove write-back and no-cookie removal. If Chrome does not persist a fixture Cookie under these conditions, the capability remains `Partial` and no manual Set-Cookie parser is added; parsing would risk changing domain/path/SameSite/expiry semantics.

### 5. Fail closed for secrets that cannot be safely redacted

All resolved source and transformed values must be at least eight UTF-8 bytes and remain under a bounded maximum. A bound response must be JSON or textual according to requested type and Content-Type; binary responses fail. Long secret occurrences are replaced in decoded text and headers before body parsing and Native Messaging. Errors are sanitized with the same secret set. This avoids the current false-positive corruption caused by replacing very short byte sequences while retaining the invariant that an echo endpoint cannot return a binding value to child code.

### 6. Use one stdio Fetch MCP mode over Browser Registry

The installed Native Host executable gains `--fetch-mcp`. In this mode it does not start Native Messaging or another Bridge listener. It implements bounded JSON-RPC/MCP over stdin/stdout, uses Browser Registry and the same loopback fetch client to select a live registration, creates an exact-origin no-binding session per tool call, and releases it in `finally`. The tool exposes fetch-shaped fields but no binding, authorization-grant, Cookie-name, storage, browser-control, or navigation inputs.

The stable launcher is used for persistent external configuration so self-update does not leave versioned paths behind. Panerelay-owned providers may launch the current host entry with the current Node executable because their lifetime is already bounded by that host generation.

This is preferred over exposing an unauthenticated long-lived HTTP MCP endpoint or giving Agent processes Bridge bearer tokens directly.

### 7. Route vendor tools using supported configuration, not interception

Codex app-server is launched with a process-local `panerelay_fetch` stdio MCP definition and `tools.web_search=false`. The provider's developer instruction explains when to use it. No Hook is installed because hosted WebSearch does not fire hooks.

Each Panerelay-owned Claude turn adds `panerelay_fetch` beside `panerelay_permission` in `--mcp-config`; its generated settings move `WebFetch` from ask to deny while retaining user/project/local sources and the rest of the ask policy. Claude sees a usable MCP tool immediately instead of first receiving a denied WebFetch result.

For external Agents, setup provides a separate explicit Agent-fetch operation. Codex configuration uses its supported MCP and web-search settings. Claude configuration uses its supported MCP registration and `permissions.deny: ["WebFetch"]`. Setup uses marked Codex content and structured Claude JSON, refuses reserved-name conflicts it did not install, writes a protected ownership record containing only its own entries and the prior Codex setting needed for restoration, and removes only unchanged owned entries. If a user changes an owned entry, removal reports the conflict and leaves it intact. Plain setup does not mutate external Agent configuration.

### 8. Keep Skill routing semantic

The repository Skill treats authenticated HTTP retrieval as Fetch MCP work and DOM/navigation/interaction as automation-engine work. It describes the built-in-tool limitation accurately, asks for explicit fetch-domain authorization when denied, and never requests API keys. Skill lifecycle remains owned by `npx skills`; setup configures MCP but does not install or edit Skills.

## Risks / Trade-offs

- [Strict redirect rejection breaks endpoints that previously followed redirects] → migrate adapters to canonical endpoints, add tests for accidental redirects, and classify unavoidable redirect-only sources as unsupported.
- [Adding origins to every manifest is a large breaking migration] → use one protocol bump, source-tool validation, deterministic built-in metadata tests, and no compatibility shim as requested.
- [Chrome may not persist Set-Cookie for Extension service-worker fetches consistently] → gate the claim on a committed fixture and real Extension evidence; retain explicit outgoing Cookie tests.
- [An open same-origin tab can change or close between selection and script execution] → execute once against the selected tab, catch lifecycle errors, and fail without selecting a different origin or navigating.
- [Disabling Codex hosted search also removes unauthenticated general search in Panerelay-owned Codex sessions] → expose this only in Panerelay-owned app-server configuration, preserve external defaults unless explicitly selected, and document that Fetch MCP is URL retrieval rather than search.
- [External Agent configuration formats evolve] → use supported CLIs/config schemas where possible, version-gate diagnostics, preserve unrelated entries, and classify unverified versions as Forwarded rather than silently rewriting them.
- [MCP output can be large for model context] → retain browser-fetch response bounds and add a smaller MCP text/body bound with explicit truncation metadata rather than unbounded stdout.

## Migration Plan

1. Add the MV3 fixture/spike and record redirect opacity, Cookie write-back, and localStorage behavior.
2. Land protocol v3, Bridge/Extension enforcement, and tests together; old manifests and sessions fail validation.
3. Add literal origins and protected binding policies to all built-in source adapters, migrate Cookie binding call sites, and add Flomo.
4. Add and test the Fetch MCP mode, then inject it into Panerelay-owned Codex and Claude providers.
5. Add explicit external setup/doctor/removal support and update the Skill, RFCs, compatibility records, and release checks.
6. Run package checks, complete compiled tests, isolated site E2E including Flomo when login state is available, and one real MCP-to-Extension fetch. Rollback requires reverting the lockstep Extension, Host, protocol, site artifacts, and setup package together; external setup removal runs before rollback if it was selected.

## Open Questions

None. Capability claims still depend on verification: unsupported Chrome behavior is recorded as Partial or Unsupported rather than replaced with a boundary-crossing workaround.
