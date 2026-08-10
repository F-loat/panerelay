## Approach

Use the existing built-in site adapters as the implementation template. First derive the authoritative site list from `/Users/tuyan/Documents/OpenCLI/clis`, then classify each source by inspecting whether its public commands use ordinary HTTP/fetch, browser page APIs, interceptors, native application APIs, or authenticated/write-only flows. Migrate only the fetch-shaped subset that fits RFC-0009; retain the source path and command names in the inventory for every other site.

Each migrated adapter will have a literal `panerelay.site.ts`, one `commands/<name>.ts` per supported command, and a small site-specific client/helper module when needed. The aggregate catalog arrays remain the single source of runtime discovery. The E2E harness will accept `PANERELAY_E2E_SITES=<one-site>` and execute only that site's cases, with representative stable public commands chosen from the migrated source.

## Evidence and status policy

- `Supported` requires a catalog entry, a successful build, and a completed single-site E2E result.
- `Pending` means the source behavior may become expressible later or live access could not be established; the inventory must name the missing capability or unresolved access condition.
- `Unsupported` is used only for a source whose required behavior is outside the current fetch-only contract and whose source evidence is recorded. Desktop/local application adapters are unsupported for this boundary; ordinary web page or unverified WAF cases remain Pending.
- E2E notes contain only command names, status, date, and bounded failure category. They never include raw response data, cookies, tokens, identifiers, or browser paths.

## Compatibility boundaries

The change does not add CDP or page control to site adapters. It does not request site permissions, authorize tabs, acquire control leases, or alter the Extension/Bridge protocol. Cookie-backed commands use existing cookie and CSRF binding declarations, and public commands set `withCookies: false` where appropriate. Mutating or credential-sensitive commands are omitted unless the current adapter contract can express them safely.

## Validation

For every migrated site, run its own build and one-site E2E immediately after catalog registration. At the end, run site package tests, `pnpm run check`, `git diff --check`, OpenSpec validation, and an inventory consistency script or equivalent comparison against the OpenCLI directory.

The user subsequently deferred E2E until after the implementation pass. The catalog build and 176-directory consistency check therefore run first; tasks 1.3, 3.1, 3.2, and final analysis remain open until the per-site selectors are defined and executed. This sequencing change does not relax the requirement that Supported status needs live evidence.

Simple downloads may return bounded inline text/base64 or remote resource URLs. Adapters do not create local directories, write filesystem paths, stream large media, rewrite downloaded documents, or perform multipart uploads under this change.

## Canonical numeric-leading adapter IDs

Adapter IDs are protocol strings and filesystem/registry keys, not JavaScript identifiers. The adapter-specific validator therefore accepts `^[a-z0-9][a-z0-9-]{0,63}$`, while command, argument, and protected-binding names continue through the narrower `^[a-z][a-z0-9-]{0,63}$` validator. Keeping the validators separate prevents a site-name requirement from weakening executable command or secret-binding metadata.

The built-ins use `12306` and `36kr` directly in source directories, manifests, build/catalog arrays, installed registry entries, CLI help, and E2E selectors. A manifest alias layer is rejected because it would add collision, installation, removal, provenance, help, and dispatch semantics while preserving two names for one site. There is no compatibility reader or forwarding alias for `rail12306` or `kr36`; setup removes those installed IDs and installs the canonical replacements.
