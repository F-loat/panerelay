## Why

The OpenCLI migration established that browser-cookie fetch covers most ordinary sites, but reusable gaps remain around non-UTF-8 byte decoding, consistent session/auth diagnostics, and explicit local-file upload. These gaps should be filled without turning Panerelay into a store or injection path for user-supplied site API keys, PATs, bearer tokens, or client secrets.

## What Changes

- Add site-kit helpers for bounded Base64 byte/text decoding, same-origin page seeding, JSON fetch validation, and typed site-command failures.
- Add static authentication metadata to site E2E cases so login-required, challenge-blocked, upstream, and response-shape outcomes remain distinguishable without retaining credentials or response bodies.
- Add explicit bounded file arguments, one-shot invocation artifacts, and a deterministic multipart builder so a command can upload one user-selected regular file without receiving an arbitrary filesystem path.
- Raise the decoded browser-fetch request-body bound from 8 MiB to 16 MiB so a 10 MiB file plus bounded multipart metadata can pass through the existing chunked transport.
- Migrate `sinafinance stock` as the raw-byte/GBK representative and add local fixture coverage for multipart upload.
- Amend RFC-0009 with the new artifact boundary and the explicit exclusion of user-supplied site credentials.

Non-goals:

- No DOM execution, page navigation, CAPTCHA or WAF bypass, request interception, browser-process ownership, or control-lease change.
- No user-managed adapter profile, API key, PAT, bearer token, refresh token, client secret, or private-instance credential storage/injection.
- No localStorage/sessionStorage credential binding in this change. A future browser-owned design may read an exact declared key from an already-open, explicitly authorized origin and inject it inside the Extension without persisting or returning the value.
- No OAuth callback or refresh lifecycle, streaming response, WebSocket/EventSource, directory input, batch media transfer, download manager, or implicit local-file output.
- No claim that the adapter child is an operating-system sandbox.
- No change to agent-browser 0.33.0 or its Forwarded/Partial compatibility groups; its regression suites remain required because the shared protocol and Extension transport change.

## Capabilities

### New Capabilities

- `site-adapter-artifacts`: Define explicit bounded file arguments, invocation artifacts, multipart construction, and output limitations.

### Modified Capabilities

- `browser-fetch-relay`: Increase the bounded request body for multipart bytes without changing browser authorization, credential sources, or control ownership.
- `fetch-site-adapters`: Extend manifests, invocation, structured command failures, and protected child execution for artifacts while excluding user-supplied site credentials.
- `site-adapter-development`: Expose reusable decoding, seeding, typed-error, artifact, and multipart authoring helpers through the public toolkit.

## Impact

- Protocol and transport: `packages/protocol`, `packages/bridge`, `apps/extension`, and the loopback fetch client.
- CLI: `packages/cli` adapter parsing, file preparation, session creation, child invocation, diagnostics, and tests.
- Authoring/runtime: `packages/site-kit` definitions, source validation/build, runtime, helpers, fixtures, and tests.
- Built-in coverage: `packages/sites` E2E metadata, local fixture coverage, Sina Finance commands, catalog output, and compatibility inventory.
- Architecture: RFC-0009 receives an accepted amendment; no accepted tab authorization, CDP, browser selection, permission, or control-lease decision changes.
