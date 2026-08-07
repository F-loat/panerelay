## Context

See `proposal.md` for motivation and the delta specs for observable behavior. Today the protected browser registry gives local clients a loopback port, bearer token, opaque browser ID, and generation. The Bridge already owns that loopback listener and correlated Native Messaging transport, while the Extension already owns Chrome Host Permission state and can run a service-worker `fetch`. The missing pieces are a request-specific Bridge surface, an Extension executor, and a distinct site-adapter lifecycle.

RFC-0001 defines the Extension/Bridge trust boundary, RFC-0003 defines browser-control leases, RFC-0004 separates observation from active tab control, and RFC-0006 defines multi-browser selection. The durable additions and the intentional decision not to acquire a control lease are recorded in RFC-0009 rather than weakening those accepted decisions implicitly.

Chrome's current MV3 contract requires Host Permission for cross-origin Extension fetch and for cookie access. `chrome.cookies` additionally requires the named `cookies` permission, while `declarativeNetRequestWithHostAccess` allows temporary request-header changes only for already granted hosts. The Extension therefore keeps `http://*/*` and `https://*/*` optional and adds the two named permissions. It does not preflight Host Permission; it attempts the operation and reports site-access guidance if Chrome rejects it.

## Goals / Non-Goals

**Goals:**

- Provide one typed fetch request/response model shared across CLI, Bridge, Extension, and site adapters.
- Let adapters request common Cookie-backed CSRF patterns without receiving Cookie values.
- Make raw fetch familiar enough for command-line use while retaining exact fetch semantics in the protocol.
- Scope adapter-visible Bridge credentials to fetch and a short lifetime.
- Install adapters atomically into protected user storage and discover help entirely from manifests.
- Keep all site code out of the CLI and Bridge processes.
- Preserve current browser selection, Extension registration, Native Messaging transfer, and control-lease behavior.

**Non-Goals:**

- A Panerelay domain ACL, domain prompt, side-panel request indicator, approval queue, or permission-grant flow.
- Multipart/file upload, streaming response output, WebSocket, EventSource, cache inspection, or download management.
- Remote Git/GitHub/npm adapter-source resolution. This version accepts lockstep built-in IDs and explicit local adapter directories; a remote resolver can produce the same local format later.
- Sandboxing third-party adapter code. Local adapter installation is an explicit trust decision; process isolation protects Panerelay process integrity and protocol bounds, not the user's filesystem from code they chose to install.
- Reusing OpenCLI runtime code or Mearl-specific signing, request, cloud, or test-account services.
- Interactive site login, browser Cookie export, external media downloaders, streaming downloads, or adapter-managed partial files.
- Changing agent-browser 0.33.0, Browser Use 0.13.7, Playwright CLI 0.1.17, tab authorization, or browser-process ownership behavior.

## Decisions

### 1. Add a fetch-only Bridge session instead of exposing the registration token

The CLI first selects a `BridgeState`, then creates a short-lived fetch session with `POST /fetch/sessions` using the protected registration bearer token and the selected `{browserId, generation}`. The Bridge returns an opaque session ID, fetch-only token, endpoint, and expiry. `POST /fetch` accepts only the fetch token. The CLI deletes the session in `finally`; the Bridge also expires sessions after 120 seconds and clears them at shutdown.

Raw fetch uses one session for one request. An adapter invocation uses one session for all requests made by that child process, so Bilibili can perform nav and profile calls without receiving the broader registration token. Fetch sessions are capped independently and never enter `activeLease`, participant, target, CDP, activity, or control-ownership state.

Alternative considered: call `/fetch` with the registration token. That is smaller but would require passing a broad Bridge credential to adapter executables. Alternative considered: allocate a normal automation participant. That would incorrectly surface a control lease and couple network-only work to tab ownership.

### 2. Extend Native Messaging with correlated fetch request/result messages

The protocol adds `fetch.request` and `fetch.result` messages. A request includes an opaque request ID, browser identity/generation, and validated fetch input. A result carries either the structured response or a bounded error. The Bridge keeps a pending-request map with timeout cleanup and rejects pending work on Extension disconnect or generation change. Existing transfer chunking carries larger bodies without new framing.

The initial documented limits are:

- URL: 8 KiB; method: fixed enum; headers: 128 entries, 64 KiB aggregate.
- Request body: 8 MiB decoded; Bridge HTTP JSON envelope: 12 MiB.
- Timeout: 100–120,000 ms, default 30,000 ms.
- Response body: 32 MiB decoded; complete Native Messaging envelope remains below the existing 64 MiB transfer cap.
- Fetch sessions: 16 outstanding, 120-second maximum lifetime.

Alternative considered: tunnel requests through CDP `Runtime.evaluate`. That would require an attached and controlled tab, inherit page CORS and lifecycle, and violate the network-only ownership boundary. Alternative considered: fetch in the Bridge. That would not reuse the browser cookie store and would make caller-provided cookie material necessary.

### 3. Execute fetch in the Extension with temporary request-header rules

The Extension validates the request again and collects matching cookies only when Cookie-header inclusion or a declared Cookie binding needs them. It does not preflight Chrome Host Permission: it attempts the operation directly and returns actionable site-access guidance only when Chrome rejects cookie access, DNR installation, or the fetch itself. It performs `fetch` with `credentials: 'omit'` while a temporary `declarativeNetRequest` session rule injects generated `Cookie`, `Origin`, and `Referer` headers. Caller-provided source headers win; an empty source-header value emits a remove operation. Other caller headers are passed through the Fetch API after excluding the three DNR-managed names.

The request model additionally accepts at most 16 `cookieBindings`. Each binding names one Cookie and one destination `{ kind: 'form' | 'json' | 'header', name }`, plus `transform: 'raw' | 'url-decode'` and `required`. Resolution uses only non-partitioned cookies applicable to the exact target URL and deterministically prefers the longest-path match for duplicate names. Binding values remain local variables in the Extension. Form and JSON bindings require a UTF-8 body, replace the destination's caller-supplied top-level value, set or validate the matching content type, and re-check the 8 MiB body bound after injection. Header bindings reject `Cookie`, `Origin`, `Referer`, and unsafe header names. Form and JSON destinations cannot be mixed in one request. Optional absent bindings are omitted; required absent bindings fail before DNR or fetch. `withCookies: false` suppresses only the generated Cookie header, not an explicitly declared binding.

Credential-bound requests use `redirect: 'error'` so the injected value cannot cross to a redirect destination. Query destinations are intentionally unsupported because URLs are routinely retained in logs and history. Errors are sanitized against every resolved raw or transformed value before crossing Native Messaging. The protocol exposes this generic primitive to installed adapters but the raw CLI does not initially add Cookie-binding flags.

Rules match the exact target URL and Extension initiator. Requests sharing the same target URL are serialized so temporary rules cannot cross-contaminate concurrent requests. Reserved session-rule IDs are cleaned at Extension startup and after every request. Response reading enforces the decoded byte limit before text/JSON conversion; binary or requested Base64 responses are encoded explicitly.

Alternative considered: `credentials: 'include'` without cookie collection. Cross-site cookie and SameSite behavior would vary by initiator and would not match the explicit authenticated-request contract. Alternative considered: a Bilibili-only CSRF field in the Extension. That would violate the site/core boundary and fail to support common form, JSON, and header double-submit patterns. Alternative considered: return one named Cookie to the adapter. That would directly weaken the credential boundary. Alternative considered: persistent dynamic rules. Session rules reduce stale state after browser restart and are still cleaned eagerly.

### 4. Model raw CLI input separately from protocol input

`panerelay fetch <absolute-http(s)-url>` parses familiar flags into the strict protocol object. `--header/-H` splits only at the first colon; `--query` does the same and appends rather than overwrites. `--data` carries UTF-8 text and `--data-base64` carries validated Base64. The complete structured response is pretty-printed as JSON so status and headers are never lost.

The first operand dispatch rule is deterministic: an absolute HTTP(S) URL means raw fetch; otherwise it must match an installed adapter ID. Global `--help` and `--version` remain meta options. Global `--lang` is consumed before the fetch/site command operands; after `<site> <command>`, a manifest-declared `lang` belongs to that adapter command so `bilibili subtitle --lang zh-CN` remains OpenCLI-compatible. Fetch-specific help is generated without browser selection. Adapter commands reserve `--json` as a presentation option: their default rendering follows OpenCLI's column-oriented table using the manifest output order and includes an item-count plus one-decimal elapsed time. The timer follows OpenCLI's concrete-command action boundary, starting before argument preparation and stopping before result rendering. `--json` prints only the unchanged structured child result. Raw fetch continues to print its complete response envelope as JSON.

Alternative considered: curl-compatible option breadth. Exact curl emulation would introduce misleading unsupported behaviors and accidental dependence on curl parsing. The initial flags cover the fetch request model directly.

### 5. Define a strict two-file adapter source and protected installed registry

A source directory contains `panerelay-fetch-adapter.json` and one self-contained `.mjs` entry named by a safe relative manifest field. The strict `panerelay.fetch-adapter.v1` manifest contains only bounded metadata:

```json
{
  "protocol": "panerelay.fetch-adapter.v1",
  "id": "bilibili",
  "name": "Bilibili",
  "version": "0.8.0",
  "description": "Authenticated Bilibili fetch commands.",
  "entry": "adapter.mjs",
  "commands": [
    {
      "name": "me",
      "description": "Show the current Bilibili profile.",
      "access": "read",
      "args": [],
      "output": ["name", "uid", "level", "coins", "followers", "following"],
      "examples": ["panerelay fetch bilibili me"]
    }
  ]
}
```

Setup validates every source in a batch before staging artifacts. Active files live at `~/.panerelay/fetch-adapters/<id>/<version>/`, and `~/.panerelay/fetch-adapters/registry.json` records the normalized manifest, absolute executable path, and SHA-256 digest. Directories are mode `0700`, files `0600`, and registry replacement is atomic. Old version directories are cleaned only after the new registry commits. Windows relies on user-scoped storage and regular-file/symlink checks where POSIX modes are unavailable.

Built-in site sources live as plain directories under `packages/sites/src/<site>` rather than as nested workspace or npm packages. The single public `@panerelay/sites` package owns their typecheck, tests, bundle generation, and lockstep version through one TypeScript source root. It builds every built-in site to the same two-file install-source format and exports the fixed catalog; its packed-artifact tests verify that inventory. `@panerelay/setup` depends on the matching catalog version but does not embed those bundles. This follows OpenCLI's useful distribution property—one npm package carries the built-in site catalog—while retaining Panerelay's explicit per-site trust/install step. `add bilibili` resolves only that catalog entry; a path containing a separator or resolving to an existing directory is treated as a local source. No ambient package-name or `PATH` discovery occurs.

Inside a built-in site directory, `index.ts` is the executable protocol boundary, `commands/index.ts` is the explicit command registry, and every public command has one matching file directly under `commands/`. Each command file also declares its typed help metadata, from which the catalog build generates the static installed `panerelay-fetch-adapter.json`; no source manifest is maintained by hand. Only genuinely reused command logic belongs under `commands/_shared/`; a site-specific `client.ts` is optional rather than part of the adapter contract. The stdin/stdout entrypoint is intentionally kept local for the first site. If a second site repeats that plumbing, extract a Node adapter runtime from the two concrete implementations instead of declaring a public runtime abstraction from Bilibili alone.

Alternative considered: dynamically import user adapters in the CLI. A bad adapter could corrupt CLI state, intercept secrets for unrelated operations, or break help. Alternative considered: a fully declarative request pipeline. WBI signing and future multi-step adapters need controlled computation, so a small executable contract is more general.

### 6. Invoke adapters through a one-shot bounded child protocol

The CLI reads and validates the protected registry, confirms containment, regular-file type, ownership/mode where supported, and executable digest before it reads browser state. For execution it selects the browser, creates a fetch session, and spawns `process.execPath <entry>` with a minimal environment and one JSON stdin message:

```text
{ protocol, requestId, operation: "execute", command, args,
  fetch: { endpoint, token, expiresAt } }
```

The adapter writes one correlated JSON response containing either `result` or a bounded error. Stdout is limited to 8 MiB, stderr to 64 KiB, and execution to 120 seconds. The CLI never prints the input message. Help reads only registry metadata and never spawns the entry.

Alternative considered: let the child read `~/.panerelay/browser-registry` itself. Central selection would be lost and every adapter would receive broad credentials. Alternative considered: a long-running adapter daemon. One-shot execution has simpler lifecycle, update, and revocation behavior for the first command set.

### 7. Port the fetch-compatible Bilibili command surface independently

The site package exposes 16 read commands (`whoami`, `me`, `video`, `search`, `hot`, `ranking`, `dynamic`, `feed`, `feed-detail`, `favorite`, `history`, `following`, `user-videos`, `comments`, `subtitle`, and `summary`) plus three writes (`comment`, `follow`, and `unfollow`). Shared helpers independently implement BVID/short-link and UID resolution, positive page/limit validation, envelope/auth errors, WBI key derivation and signing, API requests, selected video parts, and bounded row formatting. The adapter sets Bilibili `Origin` and `Referer` explicitly and validates all fields used to produce output. No OpenCLI module is imported or copied wholesale.

The write commands use a URL-encoded body and a required `bili_jct` → `csrf` Cookie binding. `comment` retains the explicit `--execute` guard and resolves mentions before posting; `follow` and `unfollow` pre-check relation state, avoid unnecessary writes, and poll for the expected result. A daily-Chrome spike verified that omitting the binding returns Bilibili code `-111`, while a resolved binding allowed a real comment add/delete and a follow/unfollow cycle with cleanup. The repository retains no account identifiers, Cookie values, request bodies, or machine-specific evidence from that run.

`login` remains `Unsupported` because fetch cannot navigate a foreground tab or wait for interactive authentication. `download` remains `Unsupported` because it requires Cookie export to yt-dlp, browser/page behavior, streaming media, and filesystem output. The implemented Bilibili commands remain `Forwarded` until representative real logged-in Chrome runs confirm their current endpoints and output shapes; verified individual commands may be recorded separately in compatibility documentation. Browser fetch itself remains `Partial` for any unverified browser/version cases. Existing agent-browser, Browser Use, and Playwright behavior remains at its current classification if regression tests pass.

## Risks / Trade-offs

- [Temporary DNR rule could affect an unrelated identical Extension request] → Match exact URLs, restrict the initiator, serialize identical target URLs, use reserved IDs, and remove rules in `finally` plus startup cleanup.
- [Adding `cookies` and `declarativeNetRequestWithHostAccess` expands named Extension capability] → Continue requiring optional per-origin Host Permission, never grant it from fetch, collect only target cookies, and document the new capability in RFC-0009 and Store review notes.
- [A generic binding could carry a Cookie value farther than intended] → Restrict lookup to cookies applicable to the exact request URL, prohibit query destinations and redirects, bound and validate destinations, sanitize errors, keep values inside the Extension, and retain the explicit local-adapter trust model.
- [Adapter child receives a short-lived bearer token] → Scope it to fetch endpoints, bind it to one browser generation, cap lifetime/concurrency, pass it only over stdin, and redact child/Bridge diagnostics.
- [A user-installed local adapter is arbitrary code] → Require explicit local path installation, protected immutable-by-others storage, digest checks, separate process execution, and clear trust documentation; do not imply an OS sandbox.
- [Native Messaging buffers large bodies in memory] → Keep request/response bounds below the established transfer maximum and do not add streaming or files in this version.
- [Bilibili WBI or response fields can change] → Validate every envelope, return actionable adapter errors, keep site logic isolated, and classify compatibility as Forwarded until live evidence is recorded.
- [No Panerelay domain ACL in the first version] → Keep all traffic behind authenticated loopback and existing Chrome Host Permission, make the omission explicit in RFC-0009, and locate future policy enforcement at fetch-session creation and request forwarding.

## Migration Plan

1. Ship protocol, Bridge, Extension, CLI, setup, and bundled adapter changes in the same lockstep release.
2. Existing installations continue to work; no fetch adapter is installed by base setup or update.
3. Reload or update the Extension to gain fetch protocol support and the two named API permissions. Existing optional Host Permission choices remain unchanged.
4. Users explicitly run `npx --yes @panerelay/setup add bilibili` (or add local adapters) to populate or replace the adapter registry entry with the expanded manifest.
5. Rollback removes installed fetch adapters with setup `remove --all`; older lockstep components ignore no state except the standalone `fetch-adapters` directory. Existing Native Host, automation adapters, defaults, and browser registrations remain intact.
