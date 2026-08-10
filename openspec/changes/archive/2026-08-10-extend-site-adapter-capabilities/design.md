## Context

RFC-0009 defines browser fetch as an Extension-executed, browser-cookie-aware request path with bounded request and response bodies. It deliberately keeps user-supplied site API credentials, streaming, and filesystem workflows outside adapter execution. The migration change proved that ordinary Base64 responses and multi-request session preparation are already expressible, while explicit file inputs require new invocation data.

The current fetch-adapter child receives a minimal environment, one short-lived fetch endpoint, and primitive command arguments. Browser Cookie bindings resolve only inside the Extension. Installed manifests, invocation messages, and responses use exact bounded validation. All distributable components ship lockstep, so this change can replace the adapter/session protocol as one coherent release.

This change amends RFC-0009. It does not supersede RFC-0001, RFC-0002, or RFC-0006 authorization, browser selection, control ownership, or opaque-identifier decisions. agent-browser remains pinned at 0.33.0 and its compatibility classifications do not change.

## Goals / Non-Goals

**Goals:**

- Add one narrowly scoped sensitive input: one explicitly selected regular file.
- Keep local paths out of adapter invocation while allowing the command to receive that file's bounded bytes.
- Keep the strict current adapter/session wire model and reinstall built-ins through setup.
- Reuse browser fetch, domain grants, Host Permission, Native transfer framing, and one-shot child execution.
- Make site failures and E2E blockers machine-readable without retaining sensitive payloads.
- Remove the user-managed Adapter Profile and site-secret injection surfaces before release.

**Non-Goals:**

- Accepting, storing, selecting, or injecting API keys, PATs, bearer tokens, refresh tokens, client secrets, or private-instance credentials supplied by the user.
- Reading localStorage or sessionStorage in this change.
- Treating adapter processes as an OS sandbox or protecting user files from explicitly malicious installed code.
- OAuth callbacks or refresh lifecycle, DOM/page execution, streaming, directories, batch transfer, automatic output writes, or background downloads.
- Adding a second direct-network executor in the Bridge or moving browser cookies outside the Extension.
- Changing browser-control, focus, tab authorization, or automation-provider behavior.

## Decisions

### 1. Keep one strict lockstep v2 artifact/error model

The manifest protocol, registry protocol, and fetch-session protocol remain v2. The argument union gains `file`, invocation requests may carry `artifacts`, and unsuccessful invocation responses use only the structured error object. Validators reject v1 adapter, registry, session, and string-error messages.

The v2 schema does not contain profile metadata, selected profile values, adapter credential context, or credential bindings. Setup rebuilds and reinstalls built-ins under the v2 manifest/registry identifiers, and all lockstep packages and the Extension update together.

Alternative: return to v1 after removing profiles. Rejected because file artifacts, structured errors, and larger bounded input remain intentional breaking changes.

### 2. Exclude user-managed site credentials

Panerelay does not provide adapter profile storage or a `profiles` CLI. Adapter manifests cannot declare profile fields or API secrets, invocation input cannot carry profile values, and fetch sessions cannot carry user-supplied site credentials. Cookie/CSRF bindings remain browser-owned and unchanged.

Sites that require users to apply for, copy, or manually configure API keys, PATs, bearer tokens, refresh tokens, or client secrets remain Pending or Unsupported. This policy applies even if Panerelay could technically encrypt or origin-bind such values.

Alternative: retain the protected Profile implementation and hide it from ordinary help. Rejected because the product boundary excludes the capability itself, not just its discoverability.

### 3. Treat browser storage as a separate future capability

localStorage and sessionStorage values created by an authenticated website are browser login state, not user-managed API-key configuration. A future design may allow the Extension to read one statically declared key from an already-open, explicitly authorized exact origin and inject a derived value directly into a statically declared request destination.

That future path requires its own RFC amendment and executable spike. It must define tab/origin selection, source and destination origin authorization, JSON-field extraction, redirect behavior, revocation, write/control-lease interaction, and a guarantee that the value is never persisted by Panerelay or returned to the Bridge or adapter. No placeholder protocol field is retained in this change.

Alternative: generalize the current Profile credential binding to localStorage. Rejected because Profile values are resolved in the CLI/Bridge, while browser storage must remain Extension-owned and depends on an explicitly authorized live page.

### 4. File paths terminate in the CLI

At most one command argument may use type `file`. Argument parsing retains its explicit path only inside the CLI. Before browser selection, the CLI opens the exact path with no-follow semantics where available, verifies a non-symlink regular file, checks a 12 MiB limit, reads it once, and rechecks file identity and size. The invocation replaces the path value with a safe basename and carries one artifact containing an opaque argument ID, basename, media type, decoded size, and Base64 bytes.

The generated site context exposes `artifact(name)` and never exposes the original path. Runtime input rises to a bound sufficient for one 12 MiB Base64 artifact plus protocol metadata. The child remains trusted installed code, but it receives only the file the user named rather than ambient path authority through the product contract.

Alternative: pass the original path and let the child read it. Rejected because it makes path access implicit, leaks machine-specific paths into adapter errors/results, and cannot enforce one-file bounds before child execution.

### 5. Multipart construction stays in site-kit

No multipart AST crosses the Bridge or Native Messaging. Site-kit accepts bounded text parts and the one invocation artifact, generates a collision-resistant deterministic boundary from part metadata/content, validates names and filenames against CR/LF injection, and returns the matching content type plus a Base64 browser-fetch body. The existing body transport then carries ordinary bytes.

The decoded browser-fetch request bound increases to 16 MiB and the loopback HTTP JSON bound increases proportionally while remaining below the 64 MiB Native transfer ceiling. This covers a 10 MiB PDF and multipart fields but intentionally excludes large media.

Alternative: make the Extension assemble multipart from local artifact handles. Rejected because the Extension cannot read local files and a new bidirectional artifact broker would add lifecycle and authorization complexity without improving the first bounded upload case.

### 6. Typed errors are mandatory and sanitized

Site-kit adds `SiteError` codes for invalid input, authentication required, missing credential, challenge required, upstream failure, response-shape drift, empty result, unsupported behavior, and generic command failure. Generated runtimes serialize code, bounded message, and retryability. Ordinary `Error` values become generic command failures. The CLI accepts only this structured failure shape.

E2E cases gain optional metadata for public, optional-auth, and required-auth behavior plus an expected blocker category. Tests and compatibility records retain only category and command-level evidence.

### 7. Reusable session and byte helpers do not add browser behavior

Site-kit Base64 helpers decode the existing response representation using `Uint8Array` and `TextDecoder`; GBK is verified on the supported Node floor. Session helpers perform ordinary bounded `context.fetch` calls, preserve explicit Referer/Origin, and may seed only read workflows. They never navigate, execute page JavaScript, retry writes, inspect browser storage, or acquire a lease.

## Risks / Trade-offs

- [Sites with official API keys remain unsupported] → Record the product policy explicitly and keep site classifications conservative.
- [Future localStorage support needs page ownership decisions] → Require a separate RFC-backed spike instead of retaining a generic credential field.
- [Base64 inflates invocation and loopback JSON] → Permit one 12 MiB artifact, cap decoded request bodies at 16 MiB, raise explicit JSON/input bounds proportionally, and retain the existing 64 MiB transfer ceiling.
- [Files can change while read] → Use no-follow open where supported and compare identity, size, and modification metadata before and after reading.
- [The v2 protocol invalidates installed v1 adapters] → Ship packages lockstep, rebuild built-ins, make setup reinstall v2 registry entries, and fail clearly on stale protected state.
- [Live external upload E2E may be unavailable] → Verify multipart bytes against a credential-free fixture and classify external site commands conservatively.

## Migration Plan

1. Amend RFC-0009 and remove Profile/secret decisions from the accepted current design.
2. Remove profile and credential-binding protocol fields, protected state, CLI commands, Bridge/Extension runtime branches, and tests.
3. Retain file argument preparation, invocation artifacts, multipart helpers, bounds, typed errors, and byte/session helpers.
4. Rebuild built-in artifacts and replace the Profile-secret fixture with a credential-free multipart fixture.
5. Run package and adversarial tests, then daily-Chrome fetch/site E2E where permissions are available.

Rollback requires reinstalling matching v1 adapters and registry state with the older lockstep release. Removed Profile state is not migrated or read. No browser registration, fetch-domain grant, Host Permission, tab authorization, or control lease migration is required.
