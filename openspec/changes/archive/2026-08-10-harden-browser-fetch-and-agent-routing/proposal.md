## Why

Browser-backed fetch already keeps browser credentials inside the Extension, but its generic request contract does not yet scope a caller to intended origins, reject redirects before an unreviewed second request, read exact-origin web storage, or define browser Cookie write-back and secret-redaction behavior precisely. Codex and Claude Code can both consume MCP tools, so Panerelay can also offer one supported authenticated-fetch path instead of asking Agents to fall back to unauthenticated hosted web tools.

## What Changes

- **BREAKING**: require every fetch session and site-adapter manifest to declare bounded HTTP(S) origin scopes; reject initial requests outside that scope and reject every redirect.
- Remove implicit redirect following and reject redirects before a second request is sent. Browser Fetch does not expose redirect targets early enough for an MV3 service worker to authorize each hop safely.
- Add exact-origin `localStorage` bindings whose values are read and injected only inside the Extension from an already-open matching tab; no storage value crosses the Bridge or adapter boundary.
- Define Cookie lifecycle behavior: browser responses may update unpartitioned browser Cookies, while outgoing Cookie attachment remains Extension-controlled; partitioned Cookies remain unsupported without a truthful top-level-site context.
- Replace blind response-wide short-secret substitution with bounded, representation-aware redaction and fail closed when a binding value is too short to redact safely.
- Add a fetch-only Panerelay MCP server that uses the same browser selection, origin scope, domain authorization, timeout, size, and credential non-disclosure boundaries as the CLI. Its HTTP methods may mutate upstream state, so it is not annotated as read-only.
- Integrate that MCP server into Panerelay-owned Codex and Claude Code conversations. Claude Code's built-in `WebFetch` is denied for those conversations; Codex hosted web search is disabled for those conversations because Codex Hooks cannot intercept hosted tools.
- Provide explicit external-Agent configuration guidance and setup support. Persistent Codex or Claude Code configuration changes happen only when the user selects the integration and are reversible; Panerelay does not patch either runtime or claim transparent interception of its built-in hosted tool.
- Update the unified `panerelay` Skill so browser-authenticated HTTP requests prefer the Panerelay Fetch MCP tool while DOM, navigation, and browser automation continue through the selected automation engine.
- Record a bounded MV3 spike and compatibility evidence for redirect visibility, Cookie write-back, and exact-origin storage access.

Non-goals: this change does not navigate tabs to obtain storage, export Cookies or storage values, accept user-managed API keys, emulate a top-level site for partitioned Cookies, replace general web search, change tab authorization or control-lease semantics, or add browser automation semantics to fetch. Panerelay continues to own only its Extension/Bridge relay; Codex and Claude Code retain ownership of model behavior, native tool selection, and their configuration formats.

## Capabilities

### New Capabilities

- `agent-web-fetch-routing`: A stable Panerelay Fetch MCP surface plus bounded Codex and Claude Code routing and explicit external-Agent configuration.

### Modified Capabilities

- `browser-fetch-relay`: Add origin-scoped sessions, universal redirect rejection, exact-origin storage bindings, Cookie write-back, and safe secret redaction.
- `fetch-site-adapters`: Require declared adapter origins and allow browser-state bindings without exposing their values.
- `panerelay-cli`: Add the stdio Fetch MCP entrypoint and scope raw fetch sessions to the requested origin.
- `claude-code-agent-provider`: Inject Panerelay Fetch MCP and deny built-in WebFetch only for Panerelay-owned Claude turns.
- `sidepanel-agent-context`: Permit the bounded Panerelay-owned fetch MCP while retaining the prohibition on arbitrary browser MCP injection.
- `panerelay-skill`: Provide one Panerelay Agent entry point that routes browser-authenticated request tasks to Panerelay Fetch MCP without changing automation-engine workflows.
- `stable-distribution`: Package, configure, diagnose, and remove the optional Agent fetch integration without changing the pinned agent-browser 0.33.0 compatibility baseline.
- `setup-cli-localization`: Add localized, explicit lifecycle controls for the optional external-Agent fetch integration.

## Impact

Affected areas include the fetch protocol, CLI, Bridge relay and Native Host modes, Extension fetch executor, site-kit manifests, built-in site adapters, Codex and Claude Code Providers, setup/doctor lifecycle, the repository Skill, RFC-0001/RFC-0009 or a superseding RFC, compatibility records, and MV3 spike fixtures. The protocol and generated adapter artifacts change incompatibly in lockstep. No new model credential, API key, browser-control dependency, or external runtime fork is introduced; agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, Playwright CLI 0.1.17, Codex, Claude Code, Qoder, and OpenCode regression groups remain affected verification surfaces.
