## Why

Panerelay can reuse a person's authorized daily-browser tabs for automation, but it cannot yet issue a fetch-shaped HTTP request with that browser's session or expose reusable site-oriented commands. Adding one browser-backed request boundary and setup-managed site adapters enables authenticated API workflows such as reading the current Bilibili profile without reimplementing a browser engine.

## What Changes

- Add a bounded `panerelay fetch <url>` surface that selects one live Panerelay browser, sends a fetch-shaped request through the Bridge and Extension, and returns a structured response.
- Support custom request method, query, body, response mode, timeout, cookies, and headers, including explicit `Origin` and `Referer` values.
- Add a versioned site-adapter manifest and out-of-process invocation contract stored under protected user-scoped `~/.panerelay` storage.
- Add localized `@panerelay/setup add <adapter...>`, `add --all`, `remove <adapter...>`, `remove --all`, and adapter-list behavior for single or batch adapter lifecycle management.
- Make `panerelay fetch --help`, `panerelay fetch <site> --help`, and `panerelay fetch <site> <command>` discover installed adapter metadata without loading adapter code into the CLI process.
- Render adapter results as an OpenCLI-style table by default and support `--json` for explicit structured output.
- Add bounded cookie-value bindings that let the Extension inject a target URL's applicable Cookie value into a form field, top-level JSON field, or request header without disclosing the value to the Bridge, CLI, or adapter process.
- Add one public lockstep `@panerelay/sites` catalog for built-in bundles, keep Bilibili as a plain source directory under `packages/sites/src/bilibili`, and implement the 19 OpenCLI-compatible operations that fit the fetch boundary, including CSRF-protected comment, follow, and unfollow writes.
- Record the cross-package request, adapter, and credential-handling boundary in a new RFC and document Chrome/Edge compatibility expectations.
- Defer a Panerelay-owned domain permission policy, per-domain approvals, and request-access UI to a later change. This first version relies on the browser Extension's existing Chrome Host Permission state and fails explicitly when Chrome has not granted the target origin.
- Preserve browser ownership boundaries: fetch does not attach, focus, navigate, close, or mutate a tab and does not grant site permission or acquire a browser-control lease. It cannot supply browser-process features such as proxy selection, isolated profiles, or top-level request containment.

## Capabilities

### New Capabilities

- `browser-fetch-relay`: Fetch-shaped request and response transport across the CLI, Bridge, Native Messaging protocol, and Extension.
- `fetch-site-adapters`: Protected setup-managed site-adapter installation, discovery, help, invocation, removal, and the fetch-compatible Bilibili command set.

### Modified Capabilities

- `panerelay-cli`: Extend the standalone CLI with raw and adapter-backed fetch commands while retaining browser selection and credential non-disclosure guarantees.
- `setup-cli-localization`: Localize setup's new adapter add, remove, list, help, validation, and result output.

## Impact

- Affects `@panerelay/protocol`, `@panerelay/bridge`, `@panerelay/extension`, `@panerelay/cli`, `@panerelay/sites`, `@panerelay/setup`, the Bilibili site source, root documentation, and RFC/compatibility records.
- Adds protected adapter artifacts and a registry under `~/.panerelay/fetch-adapters/` plus one aggregate public package for the lockstep built-in catalog.
- Adds no third-party runtime dependency and does not modify or fork OpenCLI or Mearl; their implementations are behavioral references only.
- Affects Chrome and Edge Native Messaging/Extension compatibility. The accepted agent-browser 0.33.0 baseline and agent-browser behavior are unchanged; agent-browser, Browser Use, and Playwright compatibility groups require regression coverage only.
