# RFC-0009: Browser-backed fetch and site adapters

- RFC: 0009
- Title: Browser-backed fetch and site adapters
- Status: Accepted
- Authors: F-loat
- Created: 2026-08-06
- Updated: 2026-08-07
- OpenSpec: `openspec/changes/add-browser-fetch-adapters`

## Summary

Panerelay will expose a bounded fetch-shaped request path through one selected live Chrome or Edge Extension. The Bridge creates short-lived fetch-only sessions, correlates requests over Native Messaging, and returns structured HTTP responses. The Extension uses its existing Chrome Host Permission for the target without a separate preflight check, optionally collects browser cookies, and uses temporary request-header rules so caller-provided `Origin` and `Referer` values are preserved. If Chrome rejects one of those operations, the returned error includes site-access guidance.

Fetch is not a CDP operation. It does not attach, observe, navigate, focus, or control a tab, and it never creates a relay participant or browser-control lease. This first version deliberately adds no Panerelay-owned domain ACL or permission prompt. Chrome Host Permission remains mandatory and is never granted by the fetch path.

The standalone CLI also supports setup-managed site adapters. Each adapter has a strict metadata manifest and one self-contained executable. Setup installs built-in or explicit local adapters into protected user storage; CLI help reads only their manifests, and command execution occurs out of process with a short-lived fetch-only credential. The first built-in adapter implements the fetch-compatible Bilibili command set.

## Relationship to existing RFCs

- RFC-0001 remains authoritative for the Extension/Bridge trust boundary, authenticated Native Messaging, local-first operation, and the rule that the Extension does not spawn native processes.
- RFC-0003 remains authoritative for automation participants, control leases, liveness, and activity. Fetch-only sessions are intentionally outside that model because they cannot issue CDP or tab operations.
- RFC-0004 remains authoritative for observed and controlled targets. Browser fetch creates neither state.
- RFC-0005 remains authoritative for shared Chrome and Edge hosting.
- RFC-0006 remains authoritative for deterministic browser registration selection and generation pinning. Fetch applies the same selection order to each new invocation.
- RFC-0008 remains authoritative for lockstep Native Host negotiation and update. Fetch protocol, Extension, CLI, the aggregate sites catalog, setup, and built-ins ship together.

This RFC extends RFC-0001's protocol families and RFC-0006's CLI scope. It does not supersede site permission, tab authorization, control ownership, browser-process, or release decisions.

## Goals and non-goals

### Goals

1. Reuse a selected browser profile's applicable cookies for bounded HTTP requests.
2. Support fetch-shaped method, headers, query, body, timeout, cookies, and response decoding, including explicit source headers.
3. Keep the Bridge as the authenticated local routing boundary and bind every request to one browser generation.
4. Give adapter processes only a short-lived fetch credential rather than the registration bearer token.
5. Install, discover, invoke, update, and remove versioned site adapters without loading their code into the CLI or Bridge process.
6. Preserve current tab authorization, CDP participant, activity, and control state exactly.
7. Support common Cookie-backed CSRF form, JSON, and header patterns without returning Cookie values to adapters.

### Non-goals

1. A Panerelay domain allowlist, domain approval, per-request approval, request activity UI, or permission-grant flow.
2. File upload, multipart construction, streaming bodies, streaming responses, WebSocket, EventSource, or download management.
3. Remote Git, GitHub, npm, or marketplace resolution for adapter sources.
4. An operating-system sandbox for explicitly installed local adapter code.
5. Proxy selection, isolated profiles, top-level request containment, incognito routing, or browser-process ownership.
6. Importing or depending on Mearl or OpenCLI runtime code.

## Terminology

- **Browser fetch**: an HTTP(S) request executed by the Panerelay Extension service worker for an authenticated local caller.
- **Fetch session**: a bounded, short-lived Bridge credential that permits only browser-fetch requests for one browser ID and generation.
- **Fetch adapter**: a manifest plus one self-contained executable implementing named site commands through a provided fetch session.
- **Built-in adapter**: a lockstep adapter artifact carried by the aggregate `@panerelay/sites` package but installed only by explicit user request through setup.
- **Local adapter source**: an explicit filesystem directory containing the public two-file adapter format.
- **Chrome Host Permission**: Chrome or Edge's own grant allowing the Extension to contact and access cookies for an origin. It is separate from the deferred Panerelay domain policy.

## Architecture

```text
panerelay fetch URL ────────┐
                            │ select one registration
site adapter child ────────▶│ @panerelay/cli
   ▲ fetch-only endpoint    │ create/release fetch session
   └────────────────────────┘
                            │ authenticated loopback HTTP
                            ▼
                     Panerelay Bridge
                     fetch-session scope,
                     bounds, generation,
                     Native correlation
                            │ Native Messaging
                            ▼
                     Panerelay Extension
                     Chrome access attempt,
                     cookies, temporary DNR,
                     service-worker fetch
                            │
                            ▼
                       HTTP(S) origin
```

The Bridge's existing loopback server owns the new endpoints. No central daemon or cloud service is added. Each browser registration continues to have a separate Host process, port, protected registration token, Extension connection, Host Permission set, and failure boundary.

## Fetch sessions and loopback protocol

The protected registration bearer token authorizes fetch-session creation and release:

```text
POST   /fetch/sessions
DELETE /fetch/sessions/<opaque-session-id>
POST   /fetch
```

Session creation requires the protocol version and exact selected browser ID/generation. The Bridge refuses stale generations, more than 16 live fetch sessions, invalid JSON, or oversized input. A successful result contains an opaque session ID, loopback endpoint, random bearer token, and expiry no later than 120 seconds. Release is idempotent; expiry, browser disconnect, Host shutdown, or generation replacement revokes the session.

`POST /fetch` accepts only a live fetch-session token. It cannot reach session creation, CDP, automation participants, Agent providers, integration setup, or other Bridge endpoints. A fetch request refreshes no automation participant and creates no control ownership. Adapter processes receive this scoped token over stdin; registration tokens never cross into adapter input or output.

## Native Messaging protocol

The lockstep protocol adds two correlated message types:

```text
fetch.request
fetch.result
```

`fetch.request` carries an opaque request ID, browser ID, generation, and validated request. `fetch.result` repeats the request ID and returns one bounded structured response or sanitized error. The Bridge permits only results correlated to a pending request and rejects pending work on timeout, Extension disconnect, or generation change.

The existing chunked Native Messaging envelope carries larger JSON bodies. Initial limits remain below the 64 MiB transfer ceiling: URL 8 KiB, at most 128 headers and 64 KiB of aggregate header material, 8 MiB decoded request body, timeout 100 through 120,000 ms, and 32 MiB decoded response body. Unsupported URL schemes, methods, encodings, sizes, and response types fail before network work.

## Extension request execution

The Extension does not query the target origin with `chrome.permissions.contains` before reading cookies, installing a temporary rule, or calling `fetch`. The manifest continues to declare HTTP and HTTPS as optional host permissions. The fetch implementation does not call `chrome.permissions.request` and does not widen a grant. If Chrome rejects one of those operations, the error identifies the origin and tells the user to grant Chrome site access.

The Extension declares `cookies` and `declarativeNetRequestWithHostAccess`. Cookie access is limited to cookies applicable to the target URL in that Extension profile. When enabled, the Extension constructs a generated `Cookie` header internally and returns only its cookie count. Browser Cookie inventory and Cookie values never enter Native Messaging, CLI output, adapter input, or default logs. A bounded binding declaration may carry one exact Cookie name as a selector, but resolution and the selected value remain inside the Extension.

Because Fetch forbids direct control of some headers, the Extension installs a temporary session-scoped `modifyHeaders` rule for `Cookie`, `Origin`, and `Referer`. Explicit caller source headers win; explicit empty values remove the generated header; omitted source headers default to the target origin and `<target-origin>/panerelay`. The rule is restricted to the exact target URL and Extension initiator. Identical target URLs are serialized, rule IDs come from a reserved range, and every rule is removed in `finally`; startup cleanup removes abandoned reserved session rules.

The actual service-worker fetch uses `credentials: omit` so only the deliberately injected cookie header applies. Response status outside 200–299 is still a successful HTTP result. Transport failures, Host Permission failures, timeouts, redirects that cannot complete, invalid decoding, and size violations are explicit errors.

### Cookie-value bindings

A bounded request may declare up to 16 Cookie-value bindings. Each declaration names a Cookie applicable to the exact target URL, chooses a form field, top-level JSON field, or non-reserved request header, and optionally requests URL decoding or optional absence. Only declarations cross Native Messaging. The Extension resolves the value from its cookie store, prefers the longest applicable path for duplicate names, overrides the destination immediately before `fetch`, revalidates the body bound, and sanitizes resolved values from errors and structured responses. Required missing Cookies fail before DNR installation or network work.

Bindings do not enable query-string injection because URLs are commonly retained in logs and history. A request with a resolved binding uses redirect rejection rather than forwarding a credential-bearing body or header to another URL. `withCookies: false` suppresses the generated Cookie header but does not disable an explicitly declared binding. Form and JSON bindings require UTF-8 bodies and cannot be mixed in one request; header bindings cannot target `Cookie`, `Origin`, `Referer`, `Host`, or `Content-Length`.

This is a protocol-level double-submit primitive rather than Bilibili-specific behavior. It covers common CSRF form fields, top-level JSON fields, and headers such as `X-CSRF-Token` while preserving the rule that Cookie values never become adapter input. It does not turn local adapters into an untrusted-code sandbox: explicit local adapters retain ordinary process authority and can direct authenticated requests to the same origins their target cookies already reach.

## CLI contract

An absolute HTTP or HTTPS first operand selects raw mode:

```text
panerelay fetch <url> [--method <method>] [-H <name:value>]...
  [--query <name:value>]... [--data <text>|--data-base64 <base64>]
  [--response <auto|json|text|base64>] [--timeout <ms>]
  [--cookies|--no-cookies] [--browser <selector>]
```

Any other first operand must match an installed adapter ID, followed by a command. `panerelay fetch --help` combines static raw-fetch help with installed manifest summaries. Site and command help come only from the protected registry and require no browser. Raw and adapter execution use RFC-0006 selection: explicit selector, saved default, or only live ready registration; ambiguity and unavailability fail closed.

The raw command prints the complete response JSON. It never prints the registration token, fetch token, generated Cookie header, or hidden child request.

## Adapter format and installation

A source directory contains only:

```text
panerelay-fetch-adapter.json
<self-contained-entry>.mjs
```

The strict `panerelay.fetch-adapter.v1` manifest declares bounded ID, name, version, description, safe entry filename, and command metadata. Command metadata includes a read/write access label, arguments, output fields, and examples. The access label is descriptive in this first version and does not implement domain or request authorization.

Setup exposes:

```text
npx --yes @panerelay/setup add <built-in-id|local-directory>...
npx --yes @panerelay/setup add --all
npx --yes @panerelay/setup remove <adapter-id>...
npx --yes @panerelay/setup remove --all
npx --yes @panerelay/setup adapters
```

Named values resolve only against a fixed built-in catalog. Built-in sites are plain source directories under `packages/sites/src/<site>` in the single public `@panerelay/sites` npm package rather than nested workspace or npm packages. That package owns their build and test lifecycle through one source root and carries all built-in bundles. `@panerelay/setup` depends on the same lockstep version and copies only explicitly selected catalog entries, so neither publishing nor installing requires one npm package per site. `--all` means every built-in in that exact catalog package. Explicit local directories are parsed as local sources; setup performs no network discovery and does not resolve ambient packages or executables.

Setup validates every requested source before staging the batch. It copies artifacts to `~/.panerelay/fetch-adapters/<id>/<version>/` with user-only permissions and atomically replaces `registry.json`, which records normalized manifest metadata, absolute installed entry path, and SHA-256 digest. CLI discovery validates protected file shape and containment. Execution additionally checks entry identity, permissions, and digest before reading Bridge state.

Removal changes only fetch-adapter registry entries and Panerelay-owned adapter version directories. It preserves the Native Host, Extension registration, automation adapters, defaults, conversations, and unrelated files.

## Adapter execution

The CLI spawns a verified entry with Node.js as a one-shot child and a minimal environment. One bounded JSON request on stdin contains the adapter protocol, correlation ID, command, validated arguments, and fetch-session endpoint/token/expiry. One bounded JSON response on stdout contains the same correlation and either the result or a sanitized error. Timeout and stdout/stderr limits terminate misbehaving children.

This is process isolation, not a security sandbox. A local adapter is code the user explicitly chose to install and can exercise ordinary user-process authority. Panerelay protects its own protocol and credentials from accidental mixing, verifies installed artifacts against setup's registry, and documents the trust decision; it does not claim to protect the filesystem from malicious local adapter code.

## Initial Bilibili adapter

The built-in Bilibili adapter lives at `packages/sites/src/bilibili` and declares 16 read commands:

```text
whoami, me, video, search, hot, ranking, dynamic, feed, feed-detail,
favorite, history, following, user-videos, comments, subtitle, summary
```

It also declares the guarded write commands `comment`, `follow`, and `unfollow`. The writes bind `bili_jct` to the `csrf` form field inside the Extension. Comment requires explicit `--execute`; relation writes pre-check and verify state. `login` is excluded because it requires foreground tab navigation and interaction. `download` is excluded because it requires Cookie export, a media downloader, streaming, and filesystem behavior outside this RFC.

Each public command has one source file under `commands`, with the explicit registry at `commands/index.ts`. Command files also own their typed help metadata, and the aggregate catalog build generates the static installed manifest from those definitions. Reused command logic is limited to `commands/_shared`; the site API client remains optional for future site sources rather than part of the adapter format. `index.ts` retains the small Node stdin/stdout protocol entrypoint for this first site. A reusable adapter runtime should be extracted only after a second site demonstrates the same entrypoint requirements.

The implementation is informed by the local OpenCLI Bilibili reference but imports no OpenCLI runtime and copies no general adapter framework. Bilibili's endpoints, CSRF behavior, and WBI shape are not supported public Panerelay dependencies; malformed, unauthenticated, or nonzero responses fail explicitly.

## Security and privacy

1. Fetch remains loopback-only and starts from a protected live browser registration.
2. Fetch sessions are random, short-lived, browser/generation-bound, fetch-only, concurrency-bounded, and explicitly releasable.
3. Registration tokens, fetch tokens, cookies, resolved Cookie bindings, source-header rules, request bodies, and response bodies are not logged by default.
4. Chrome Host Permission is never preflighted, granted, or requested by fetch; Chrome rejection is reported after the attempted operation.
5. No Panerelay domain ACL exists in this version. That omission is explicit and must be addressed by a later RFC before Panerelay claims its own domain-level authorization.
6. Browser fetch never enters CDP, target, tab authorization, participant, activity, or control-lease state.
7. Adapter help never executes code or reads browser credentials.
8. Adapter execution is out of process, bounded, protected-storage verified, and given only fetch-scoped connection material.
9. HTTP remains supported because the raw API permits it, but documentation recommends HTTPS and makes network transport visible in the supplied URL.

## Compatibility and migration

All components ship lockstep. An older Extension or Host will reject the new message/endpoint rather than silently issuing a request. Existing setup and browser automation remain functional; fetch adapters are absent until explicitly added.

Browser fetch is `Partial` for Chrome and Edge until a real daily-browser run verifies custom `Origin`/`Referer`, cookie reuse, missing Host Permission, timeout, binary/JSON handling, and reconnect behavior. The Bilibili adapter is `Forwarded` until a logged-in daily Chrome run validates the current endpoint and output fields. Unit and mocked integration tests do not upgrade either classification.

This RFC changes no agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, Playwright CLI 0.1.17, Qoder, OpenCode, Claude Code, or Codex capability claim. Their regression suites must pass because the shared protocol and Extension changed, but browser fetch does not broaden their browser-process capabilities.

Rollback removes adapters with `setup remove --all` and reinstalls matching older lockstep components. Older versions ignore the standalone `fetch-adapters` directory; no migration of existing registration or automation adapter state is required.

## Alternatives considered

### Use CDP Runtime.evaluate and page fetch

Rejected because it requires a controlled attached tab, inherits page CORS and lifecycle, and would present network-only work as tab automation.

### Fetch in the Bridge

Rejected because the Bridge does not own the browser cookie store. Copying cookies to the Bridge or caller would enlarge the credential exposure boundary.

### Give adapters the registration bearer token

Rejected because the token can access broader Bridge endpoints. Fetch-only sessions provide least-privilege protocol scope even though an explicitly malicious same-user process is outside the sandbox claim.

### Load adapter modules into the CLI

Rejected because adapter failure or side effects could corrupt CLI help, parsing, registry, or unrelated operations. Manifest-only discovery and one-shot children isolate failures.

### Limit adapters to a declarative request pipeline

Rejected because common site flows require signing, conditional validation, and multiple dependent requests. A self-contained executable keeps site logic isolated without hard-coding it into Panerelay core.

### Resolve arbitrary remote sources in setup

Deferred. Built-in IDs and explicit local directories establish the format and security checks without introducing mutable remote source resolution, lockfiles, or provenance policy.

## Delivery and acceptance

The linked OpenSpec change owns implementation details. Acceptance requires:

1. strict protocol and adversarial bound tests;
2. Bridge session authentication, expiry, generation, correlation, disconnect, and no-control-state tests;
3. Extension Host Permission, cookie redaction, source-header precedence, DNR cleanup, response decoding, and size tests;
4. CLI raw parsing, localization, selection, help-without-browser, credential redaction, and structured-output tests;
5. setup local/built-in, batch validation, atomic registry, update, list, targeted removal, remove-all, permission, digest, and packed-artifact tests;
6. Bilibili WBI and envelope fixtures with no retained credentials;
7. form, JSON, and header Cookie-binding tests covering missing Cookies, URL decoding, redirect rejection, body bounds, reserved destinations, and value redaction;
8. unchanged agent-browser, Browser Use, and Playwright regression suites;
9. daily Chrome evidence for raw fetch and Bilibili when available, with conservative classification otherwise; and
10. full workspace check, OpenSpec strict validation, diff hygiene, and no generated browser or credential artifacts in source.

This RFC remains Accepted until the governed release and applicable compatibility evidence are published. Local implementation or tests alone do not make it Implemented.
