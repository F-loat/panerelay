# RFC-0009: Browser-backed fetch and site adapters

- RFC: 0009
- Title: Browser-backed fetch and site adapters
- Status: Accepted
- Authors: F-loat
- Created: 2026-08-06
- Updated: 2026-08-10
- OpenSpec: `openspec/changes/archive/2026-08-07-add-browser-fetch-adapters`, `openspec/changes/add-site-adapter-tooling`, `openspec/changes/extend-site-adapter-capabilities`, `openspec/changes/harden-browser-fetch-and-agent-routing`, `openspec/changes/migrate-opencli-sites`

RFC-0010 extends this RFC and supersedes its v1/v2 protocol, caller-defined binding, redirect-following, `credentials: "omit"`, and browser-storage decisions. The sections below retain the original accepted design context; current fetch authority and Agent routing are defined by [RFC-0010](0010-browser-state-fetch-authority-and-agent-routing.md).

## Summary

Panerelay will expose a bounded fetch-shaped request path through one selected live Chrome or Edge Extension. The Bridge creates short-lived fetch-only sessions, correlates requests over Native Messaging, and returns structured HTTP responses. Before credential or network work, the Extension requires a matching exact/wildcard domain grant or an explicit all-domains grant. Domain policy ignores URL scheme and port. Chrome Host Permission remains a separate mandatory layer. The Extension then optionally collects browser cookies and uses temporary request-header rules so caller-provided `Origin` and `Referer` values are preserved.

Fetch is not a CDP operation. It does not attach, observe, navigate, focus, or control a tab, and it never creates a relay participant or browser-control lease. Users can grant the active page's hostname or all domains from the side panel and can expand, review, or revoke saved exact and leading-wildcard patterns such as `*.baidu.com`. An Agent can explicitly request approval with a hostname, wildcard, or URL through a registration-authenticated command; that action opens a focused Extension confirmation window where the user's click may approve only the normalized requested pattern and request the corresponding Chrome Host Permission. All-domains approval remains a settings-only user action.

The standalone CLI also supports setup-managed site adapters. Each installed adapter has a strict metadata manifest and one self-contained executable. A public source toolkit generates that form from a lightweight command-per-file TypeScript directory without a nested npm package, handwritten manifest, or site-specific protocol entrypoint. Setup installs built-in, explicit local, or explicit public GitHub adapters into protected user storage; CLI help reads only generated manifests, and command execution occurs out of process with a short-lived fetch-only credential. A command may accept one explicitly selected regular file as a bounded invocation artifact and construct one ordinary multipart request without receiving the local path. Site adapters can reuse browser Cookie state, but Panerelay does not accept user-supplied API keys, personal access tokens, client secrets, or similar credentials. The first built-in adapter implements the fetch-compatible Bilibili command set.

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
8. Support one explicit bounded local-file input and multipart construction without exposing the source path or adding general filesystem/download behavior.

### Non-goals

1. Per-request approval after a domain is already granted, path- or method-level ACLs, nested wildcard syntax, or request activity history.
2. Directory or batch input, arbitrary local-path access, implicit file output, download management, streaming bodies, streaming responses, WebSocket, or EventSource.
3. An adapter marketplace, registry search, npm package-per-site resolution, automatic adapter updates, private GitHub authentication, arbitrary Git hosts, or repository dependency installation.
4. An operating-system sandbox for explicitly installed local adapter code.
5. Proxy selection, isolated profiles, top-level request containment, incognito routing, or browser-process ownership.
6. Importing or depending on Mearl or OpenCLI runtime code.
7. User-managed API keys, personal access tokens, client secrets, OAuth callbacks, refresh-token lifecycle, CAPTCHA/WAF bypass, or model-agent sessions.
8. Reading browser `localStorage` or `sessionStorage`. A future exact-origin, Extension-owned browser-storage binding requires a separate spike and RFC covering origin, tab, lease, and navigation semantics.

## Terminology

- **Browser fetch**: an HTTP(S) request executed by the Panerelay Extension service worker for an authenticated local caller.
- **Fetch session**: a bounded, short-lived Bridge credential that permits only browser-fetch requests for one browser ID and generation.
- **Installed fetch adapter**: a manifest plus one self-contained executable implementing named site commands through a provided fetch session.
- **Source fetch adapter**: a conventional `panerelay.site.ts` plus command-per-file TypeScript tree that the public site toolkit statically validates and converts to installed form.
- **Built-in adapter**: a lockstep adapter artifact carried by the aggregate `@panerelay/sites` package but installed only by explicit user request through setup.
- **Local adapter source**: an explicit filesystem directory containing either the installed two-file format or the public source format.
- **GitHub adapter source**: an explicitly supplied public owner/repository or canonical GitHub URL resolved once to a concrete commit before source selection and installation.
- **Fetch domain grant**: Panerelay's Extension-local approval for one exact hostname, one leading-wildcard domain pattern, or all domains. It ignores scheme and port, authorizes only browser fetch, and never grants tab authorization or control ownership.
- **Chrome Host Permission**: Chrome or Edge's own match-pattern grant allowing the Extension to contact and access cookies for a domain. It is mandatory in addition to a fetch domain grant and can be shared with other Extension capabilities.
- **Invocation artifact**: one bounded regular file explicitly selected as a command argument, represented to the adapter by safe metadata and bytes without its local source path.

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

Session creation requires the protocol version and exact selected browser ID/generation. The Bridge refuses stale generations, more than 16 live fetch sessions, invalid JSON, or unknown session metadata. A successful result contains an opaque session ID, loopback endpoint, random bearer token, and expiry no later than 120 seconds. Release is idempotent; expiry, browser disconnect, Host shutdown, or generation replacement revokes the session.

`POST /fetch` accepts only a live fetch-session token. It cannot reach session creation, CDP, automation participants, Agent providers, integration setup, or other Bridge endpoints. A fetch request refreshes no automation participant and creates no control ownership. Adapter processes receive this scoped token over stdin; registration tokens never cross into adapter input or output.

## Native Messaging protocol

The lockstep protocol adds two correlated message types:

```text
fetch.request
fetch.result
```

`fetch.request` carries an opaque request ID, browser ID, generation, and validated request. `fetch.result` repeats the request ID and returns one bounded structured response or sanitized error. The Bridge permits only results correlated to a pending request and rejects pending work on timeout, Extension disconnect, or generation change.

The registration-authenticated Agent approval path adds `fetch.permission.request` and `fetch.permission.result`. The CLI accepts a hostname, leading-wildcard pattern, or URL of any parseable scheme and sends one normalized scheme-independent domain pattern. The Bridge validates that pattern and the selected browser identity/generation, keeps a bounded 90-second pending request, and forwards no registration token to the Extension or adapter. The result reports denial or the requested-domain scope; this path cannot grant all domains. Adapter children receive only fetch-session credentials and cannot open permission UI themselves.

The existing chunked Native Messaging envelope carries larger JSON bodies. Limits remain below the 64 MiB transfer ceiling: URL 8 KiB, at most 128 headers and 64 KiB of aggregate header material, 16 MiB decoded request body, timeout 100 through 120,000 ms, and 32 MiB decoded response body. Unsupported URL schemes, methods, encodings, sizes, response types, redirect modes, and unknown fields fail before network work. Removed profile and credential-binding metadata is therefore rejected rather than ignored.

## Extension request execution

The Extension extracts the target hostname and requires a matching exact/wildcard pattern or the all-domains grant before reading cookies, installing a temporary rule, or calling `fetch`. An exact pattern matches one hostname; a leading `*.` pattern matches its root plus every subdomain. A denial includes only the hostname and the explicit `panerelay fetch --authorize <hostname>` guidance. After Panerelay authorization, the Extension does not separately preflight Chrome Host Permission before its cookie, rule, or fetch operations; Chrome rejection still returns site-access guidance.

The side panel can request the HTTP and HTTPS Chrome Host Permission match patterns for one scheme-independent domain grant, then save the current active page's hostname or all domains from a direct user click. It displays the broad grant independently and preserves exact/wildcard grants when broad access is disabled. Revoking a Panerelay fetch grant never removes Chrome Host Permission because browser automation or another Extension capability may still rely on it.

`panerelay fetch --authorize <hostname|*.domain|url>` uses the selected registration rather than a fetch-session token. The Extension opens one centered popup containing only the normalized domain pattern and opaque request ID. Direct user actions can request and save only that pattern or explicitly deny and remove the identical saved Panerelay pattern; denial never removes Chrome Host Permission. All-domains approval remains available only in the side panel. Close, timeout, duplicate settlement, Extension disconnect, or generation change fails closed without modifying saved grants. Ordinary unauthorized fetch never opens a popup automatically.

The Extension declares `cookies` and `declarativeNetRequestWithHostAccess`. Cookie access is limited to cookies applicable to the target URL in that Extension profile. When enabled, the Extension constructs a generated `Cookie` header internally and returns only its cookie count. Browser Cookie inventory and Cookie values never enter Native Messaging, CLI output, adapter input, or default logs. A bounded binding declaration may carry one exact Cookie name as a selector, but resolution and the selected value remain inside the Extension.

Because Fetch forbids direct control of some headers, the Extension installs a temporary session-scoped `modifyHeaders` rule for `Cookie`, `Origin`, and `Referer`. Explicit caller source headers win; explicit empty values remove the generated header; omitted source headers default to the target origin and `<target-origin>/panerelay`. The rule is restricted to the exact target URL and Extension initiator. Identical target URLs are serialized, rule IDs come from a reserved range, and every rule is removed in `finally`; startup cleanup removes abandoned reserved session rules.

The actual service-worker fetch uses `credentials: omit` so only the deliberately injected cookie header applies. Response status outside 200–299 is still a successful HTTP result. Transport failures, Host Permission failures, timeouts, redirects that cannot complete, invalid decoding, and size violations are explicit errors.

### Cookie-value bindings

A bounded request may declare up to 16 Cookie-value bindings. Each declaration names a Cookie applicable to the exact target URL, chooses a form field, top-level JSON field, or non-reserved request header, and optionally requests URL decoding or optional absence. Only declarations cross Native Messaging. The Extension resolves the value from its cookie store, prefers the longest applicable path for duplicate names, overrides the destination immediately before `fetch`, revalidates the body bound, and sanitizes resolved values from errors and structured responses. Required missing Cookies fail before DNR installation or network work.

Bindings do not enable query-string injection because URLs are commonly retained in logs and history. A request with a resolved binding uses redirect rejection rather than forwarding a credential-bearing body or header to another URL. `withCookies: false` suppresses the generated Cookie header but does not disable an explicitly declared binding. Form and JSON bindings require UTF-8 bodies and cannot be mixed in one request; header bindings cannot target `Cookie`, `Origin`, `Referer`, `Host`, or `Content-Length`.

This is a protocol-level double-submit primitive rather than Bilibili-specific behavior. It covers common CSRF form fields, top-level JSON fields, and headers such as `X-CSRF-Token` while preserving the rule that Cookie values never become adapter input. It does not turn local adapters into an untrusted-code sandbox: explicit local adapters retain ordinary process authority and can direct authenticated requests to the same origins their target cookies already reach.

### Invocation artifacts and multipart bodies

A command manifest may declare at most one `file` argument. The CLI opens only the explicit supplied path with no-follow behavior where available, requires a stable non-symlink regular file, enforces a 12 MiB limit, reads it once, and rechecks identity and size. Adapter stdin receives one invocation artifact with an opaque argument ID, safe basename, media type, decoded size, and Base64 bytes; it never receives the original path.

Site-kit may combine that artifact and bounded UTF-8 fields into one standards-compliant multipart body and return the matching `Content-Type` plus ordinary Base64 fetch body. The resulting decoded body remains subject to the 16 MiB fetch bound. Artifacts live only for the one-shot child invocation. This capability does not add directory traversal, batch media, background transfer, arbitrary output paths, or automatic local writes.

## CLI contract

An absolute HTTP or HTTPS first operand selects raw mode:

```text
panerelay fetch <url> [--method <method>] [-H <name:value>]...
  [--query <name:value>]... [--data <text>|--data-base64 <base64>]
  [--response <auto|json|text|base64>] [--timeout <ms>]
  [--cookies|--no-cookies] [--browser <selector>]
```

Agent-requested authorization uses a separate explicit mode:

```text
panerelay fetch --authorize <hostname|*.domain|url> [--browser <selector>]
```

Any other first operand must match an installed adapter ID, followed by a command. `panerelay fetch --help` combines static raw-fetch help with installed manifest summaries. Site and command help come only from the protected registry and require no browser. Raw and adapter execution use RFC-0006 selection: explicit selector, saved default, or only live ready registration; ambiguity and unavailability fail closed.

The raw command prints the complete response JSON. It never prints the registration token, fetch token, generated Cookie header, or hidden child request.

There is no profile-management command or common API-key option. Adapter manifests, invocations, and fetch-session creation reject profile or manually supplied credential metadata.

## Source and installed adapter formats

An installed source directory contains only:

```text
panerelay-fetch-adapter.json
<self-contained-entry>.mjs
```

The strict `panerelay.fetch-adapter.v2` manifest declares bounded ID, name, version, description, safe entry filename, and command metadata. Adapter IDs use `^[a-z0-9][a-z0-9-]{0,63}$` so canonical site names such as `12306` and `36kr` do not require aliases. Command, argument, and protected-binding identifiers retain the narrower `^[a-z][a-z0-9-]{0,63}$` grammar. Command metadata includes a read/write access label, string/number/boolean/file arguments, output fields, and examples. The v2 reader rejects v1 manifests, registry state, and unknown metadata; setup rebuilds and reinstalls selected adapters as one lockstep upgrade. The access label is descriptive and does not implement domain or request authorization by itself.

An editable source adapter instead uses:

```text
panerelay.site.ts
commands/<command>.ts
commands/**/*.test.ts       # optional and test-only
<relative shared modules>   # optional
```

The lockstep public `@panerelay/site-kit` package supplies `defineSite`, `defineCommand`, author types, `init`, `check`, `test`, and `build`, plus the programmatic builder used by setup and the aggregate sites catalog. Site and command help metadata must be statically evaluable. The toolkit parses and typechecks source without importing adapter modules, generates the generic one-shot entry, bundles only relative source, allowed Node built-ins, and its own runtime, then validates the same strict two-file output setup installs. Repository package manifests, lifecycle scripts, custom build configuration, compiler plugins, arbitrary package imports, and dependency installation are ignored or rejected. Explicit `test` is the only tooling operation that runs author test code; setup never runs it.

Setup exposes:

```text
npx --yes @panerelay/setup add <built-in-id|local-directory|github-source>...
npx --yes @panerelay/setup add --all
npx --yes @panerelay/setup remove <adapter-id>...
npx --yes @panerelay/setup remove --all
npx --yes @panerelay/setup adapters
```

Named values resolve only against a fixed built-in catalog. Built-in sites are plain source directories under `packages/sites/src/<site>` in the single public `@panerelay/sites` npm package rather than nested workspace or npm packages. That package builds them through site-kit and carries all built-in bundles. `@panerelay/setup` depends on matching lockstep site-kit and catalog versions and copies only explicitly selected catalog entries, so neither publishing nor installing requires one npm package per site. `--all` means every built-in in that exact catalog package.

An existing local directory wins over remote shorthand parsing. Exact two-file contents select installed form; `panerelay.site.ts` selects source form and is built in an owned temporary directory. Explicit `github:<owner>/<repo>`, `<owner>/<repo>`, and canonical HTTPS GitHub repository URLs select public remote resolution and may include a documented ref and subdirectory. Setup uses unauthenticated GitHub HTTPS APIs to resolve the default branch or requested ref to one full commit, downloads a bounded codeload archive, rejects unsafe entries and ambiguous source roots, and records normalized public provenance. It does not invoke Git, use credential helpers, prompt for tokens, recurse through a repository looking for sites, install dependencies, or run repository code during source resolution and build. Unknown bare IDs still fail locally without network activity.

Setup resolves, downloads, builds, and validates every requested source before staging the batch. It copies artifacts to `~/.panerelay/fetch-adapters/<id>/<version>/` with user-only permissions and atomically replaces `registry.json`, which records normalized manifest metadata, absolute installed entry path, SHA-256 digest, and optional built-in/local/GitHub provenance. Existing registrations without provenance remain valid. CLI discovery validates protected file shape and containment. Execution additionally checks entry identity, permissions, and digest before reading Bridge state; it never fetches or rebuilds an adapter.

Removal changes only fetch-adapter registry entries and Panerelay-owned adapter version directories. It preserves the Native Host, Extension registration, automation adapters, defaults, conversations, and unrelated files.

## Adapter execution

The CLI spawns a verified entry with Node.js as a one-shot child and a minimal environment. One bounded JSON request on stdin contains the v2 adapter protocol, correlation ID, command, validated primitive arguments, an optional invocation artifact, and fetch-session endpoint/token/expiry. The original local file path remains absent. User credential environment variables are not forwarded. One bounded JSON response on stdout contains the same correlation and either the result or a sanitized structured error. String failures and v1 messages are rejected. Timeout and stdin/stdout/stderr limits terminate misbehaving children.

This is process isolation, not a security sandbox. A local or GitHub adapter is code the user explicitly chose to install and can exercise ordinary user-process authority when invoked. Static source inspection and build-time non-execution reduce installation side effects but do not make later command execution safe. Panerelay protects its own protocol and credentials from accidental mixing, verifies installed artifacts against setup's registry, and documents the trust decision; it does not claim to protect the filesystem from malicious adapter code.

## Initial Bilibili adapter

The built-in Bilibili adapter lives at `packages/sites/src/bilibili` and declares 16 read commands:

```text
whoami, me, video, search, hot, ranking, dynamic, feed, feed-detail,
favorite, history, following, user-videos, comments, subtitle, summary
```

It also declares the guarded write commands `comment`, `follow`, and `unfollow`. The writes bind `bili_jct` to the `csrf` form field inside the Extension. Comment requires explicit `--execute`; relation writes pre-check and verify state. `login` is excluded because it requires foreground tab navigation and interaction. `download` is excluded because it requires Cookie export, a media downloader, streaming, and filesystem behavior outside this RFC.

Each public command has one `defineCommand` source file under `commands` and owns its typed help metadata and handler. `panerelay.site.ts` owns only site identity. Reused command logic remains under `commands/_shared`, and `client.ts` remains Bilibili-specific rather than part of the adapter format. Site-kit discovery replaces the private `commands/index.ts` registry and `manifest.ts` generator; its generic runtime replaces Bilibili's former protocol `index.ts`. The aggregate catalog and external authors now use the same source contract and generated entry.

The implementation is informed by the local OpenCLI Bilibili reference but imports no OpenCLI runtime and copies no general adapter framework. Bilibili's endpoints, CSRF behavior, and WBI shape are not supported public Panerelay dependencies; malformed, unauthenticated, or nonzero responses fail explicitly.

## Security and privacy

1. Fetch remains loopback-only and starts from a protected live browser registration.
2. Fetch sessions are random, short-lived, browser/generation-bound, fetch-only, concurrency-bounded, and explicitly releasable.
3. Registration tokens, fetch tokens, cookies, resolved Cookie bindings, invocation artifact bytes, local file paths, source-header rules, request bodies, and response bodies are not logged by default.
4. Ordinary fetch never grants or requests Chrome Host Permission; Chrome rejection is reported after the attempted operation. Only explicit side-panel or Agent approval clicks may request it.
5. Every fetch requires a matching exact, wildcard, or all-domains Panerelay grant before Cookie, DNR, or network work. Fetch grants remain separate from tab authorization and control ownership.
6. Browser fetch never enters CDP, target, tab authorization, participant, activity, or control-lease state.
7. Adapter help never executes code or reads browser credentials.
8. Adapter execution is out of process, bounded, protected-storage verified, and given only fetch-scoped connection material.
9. HTTP remains supported because the raw API permits it, but documentation recommends HTTPS and makes network transport visible in the supplied URL.
10. Setup reaches the network only for an explicit public GitHub source, accepts no URL credentials or tokens, resolves one commit, bounds archive download/extraction, and never runs repository setup code.
11. Site adapters and CLI commands do not accept or persist user-managed API keys, personal access tokens, client secrets, or equivalent manually supplied credentials.
12. File input requires one explicit regular-file argument, is bounded before adapter execution, omits the source path from child input, and creates no implicit local output.

## Compatibility and migration

All components ship lockstep. Adapter, adapter-registry, and fetch-session protocols move to v2, and current readers reject v1 messages instead of carrying dual semantics. Setup rebuilds and reinstalls selected built-ins as v2 adapters. Existing browser registration, domain grants, Host Permission, and browser automation state remain functional; stale v1 fetch-adapter registry state must be replaced before adapter execution.

Browser fetch is `Partial` for Chrome and Edge until a real daily-browser run verifies custom `Origin`/`Referer`, cookie reuse, missing Host Permission, timeout, binary/JSON handling, and reconnect behavior. The Bilibili adapter is `Forwarded` until a logged-in daily Chrome run validates the current endpoint and output fields. Unit and mocked integration tests do not upgrade either classification.

This RFC changes no agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, Playwright CLI 0.1.17, Qoder, OpenCode, Claude Code, or Codex capability claim. Their regression suites must pass because the shared protocol and Extension changed, but browser fetch does not broaden their browser-process capabilities. Multipart behavior is `Verified` within the one-file and documented size bounds by local complete-path coverage; daily-browser evidence is tracked separately in the compatibility document.

Rollback reinstalls matching v1 adapters and registry state together with the older lockstep components. No browser registration, domain grant, Host Permission, or automation adapter migration is required.

## Alternatives considered

### Use CDP Runtime.evaluate and page fetch

Rejected because it requires a controlled attached tab, inherits page CORS and lifecycle, and would present network-only work as tab automation.

### Fetch in the Bridge

Rejected because the Bridge does not own the browser cookie store. Copying cookies to the Bridge or caller would enlarge the credential exposure boundary.

### Accept manually supplied API keys or tokens

Rejected because it creates credential setup, storage, lifecycle, redaction, and support obligations that are outside browser-session reuse. Sites that require users to apply for or copy a key remain unsupported.

### Pass local file paths to adapters

Rejected because it makes arbitrary path reads part of the product contract and exposes machine-specific paths. The CLI instead resolves one explicit regular file and passes only bounded bytes and safe metadata.

### Give adapters the registration bearer token

Rejected because the token can access broader Bridge endpoints. Fetch-only sessions provide least-privilege protocol scope even though an explicitly malicious same-user process is outside the sandbox claim.

### Load adapter modules into the CLI

Rejected because adapter failure or side effects could corrupt CLI help, parsing, registry, or unrelated operations. Manifest-only discovery and one-shot children isolate failures.

### Limit adapters to a declarative request pipeline

Rejected because common site flows require signing, conditional validation, and multiple dependent requests. A self-contained executable keeps site logic isolated without hard-coding it into Panerelay core.

### Resolve arbitrary remote sources in setup

Rejected. The accepted resolver is limited to explicit public GitHub repositories, resolves a ref to an immutable commit, records bounded provenance, and never treats unknown adapter names as remote packages. Arbitrary Git hosts, npm package names, registries, and ambient executables would broaden trust and credential behavior without a stable distribution contract.

### Install editable source directly like OpenCLI

Rejected for the runtime boundary. OpenCLI's source-file override layer is useful authoring precedent, but directly loading a mutable source tree would replace one protected executable digest with a multi-file runtime and force help discovery to execute or duplicate source metadata. Site-kit keeps command-per-file authoring while generating the already accepted installed form.

## Delivery and acceptance

The linked OpenSpec change owns implementation details. Acceptance requires:

1. strict protocol and adversarial bound tests;
2. Bridge session authentication, expiry, generation, correlation, disconnect, and no-control-state tests;
3. Extension Host Permission, cookie redaction, source-header precedence, DNR cleanup, response decoding, and size tests;
4. CLI raw parsing, localization, selection, help-without-browser, credential redaction, and structured-output tests;
5. setup local/built-in/GitHub, source classification, commit resolution, archive bounds, batch validation, atomic registry/provenance, update, list, targeted removal, remove-all, permission, digest, and packed-artifact tests;
6. Bilibili WBI and envelope fixtures with no retained credentials;
7. form, JSON, and header Cookie-binding tests covering missing Cookies, URL decoding, redirect rejection, body bounds, reserved destinations, and value redaction;
8. unchanged agent-browser, Browser Use, and Playwright regression suites;
9. daily Chrome evidence for raw fetch and Bilibili when available, with conservative classification otherwise; and
10. site-kit scaffold, static metadata, typecheck, no-execution, deterministic build, explicit-test, and isolated packed-consumer coverage;
11. a daily-Chrome Bilibili reinstall and representative command regression without retained credentials; and
12. full workspace check, release check, OpenSpec strict validation, diff hygiene, and no generated browser, source archive, temporary checkout, or credential artifacts in source.
13. explicit rejection tests for removed profile, user-credential, and credential-binding metadata;
14. one-file no-follow/identity/size/path-redaction tests plus deterministic multipart fixture coverage; and
15. daily Chrome or Edge local-fixture verification for multipart upload when the required domain grant and Host Permission are available.

This RFC remains Accepted until the governed release and applicable compatibility evidence are published. Local implementation or tests alone do not make it Implemented.
