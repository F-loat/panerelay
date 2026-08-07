## 1. Architecture and Protocol

- [x] 1.1 Add RFC-0009 for the browser-fetch and site-adapter boundaries, amend affected accepted RFC references, and document the deferred domain-policy decision.
- [x] 1.2 Add strict browser-fetch, fetch-session, fetch-adapter manifest, registry, and child invocation protocol types, validators, bounds, and unit tests in `@panerelay/protocol`.
- [x] 1.3 Extend RFC-0009 and the protocol with bounded form/JSON/header Cookie-value bindings, redirect and credential-disclosure safeguards, validators, and adversarial tests.

## 2. Bridge and Extension Fetch Path

- [x] 2.1 Add bounded fetch-only session creation, authenticated fetch execution, release, expiry, generation checks, and HTTP endpoint tests to the Bridge.
- [x] 2.2 Add correlated Native Messaging fetch request/result handling, timeout/disconnect cleanup, and Bridge relay tests without changing control leases or CDP participants.
- [x] 2.3 Add Extension deferred Chrome access errors, cookie collection, temporary DNR source-header injection, exact-request serialization, bounded response decoding, and focused tests.
- [x] 2.4 Update the Extension manifest and build-output tests for required named Chrome APIs while preserving optional host permissions.
- [x] 2.5 Resolve required/optional Cookie bindings only inside the Extension, inject form/JSON/header destinations, block redirects, sanitize bound values from errors, and add focused executor tests.

## 3. Panerelay Fetch CLI

- [x] 3.1 Add a browser-fetch client that selects one registration, creates/releases fetch sessions, validates generation, and redacts credentials in failures.
- [x] 3.2 Add localized raw `panerelay fetch <url>` parsing, help, request options, structured output, and parser/execution tests.
- [x] 3.3 Add the protected fetch-adapter registry reader, help discovery, digest/permission checks, bounded child dispatcher, site-command argument parsing, and tests.
- [x] 3.4 Render adapter results as OpenCLI-style tables by default, add explicit `--json` output, expose both modes in help, and cover them with CLI tests.
- [x] 3.5 Preserve manifest-declared `--lang` after adapter command operands while retaining global CLI localization before the fetch/site operands, and add parser/help tests.

## 4. Adapter Installation and Bilibili

- [x] 4.1 Add setup-managed fetch-adapter source validation, protected staged installation, atomic registry updates, single/batch/all add, targeted/all remove, listing, and lifecycle tests.
- [x] 4.2 Extend the localized setup CLI parser, help, output, and tests for `add`, `remove`, and `adapters` without invoking base setup.
- [x] 4.3 Create and bundle the Bilibili adapter manifest and executable with nav, WBI signing, profile validation, `me` output, protocol tests, and fixtures derived independently from the OpenCLI reference.
- [x] 4.4 Add the lockstep `@panerelay/sites` aggregate catalog package, make setup consume it without embedding site bundles, and cover both packed artifacts and opt-in installation.
- [x] 4.5 Keep setup as the implicit default invocation and omit its redundant command-list entry from localized help.
- [x] 4.6 Move the Bilibili implementation into the aggregate `packages/sites` package, update build/lockfile references, and verify packed setup artifacts use the new location.
- [x] 4.7 Expand the Bilibili manifest and site implementation with the 16 fetch-compatible read commands, shared validation/signing/resolution helpers, and command-focused fixtures/tests.
- [x] 4.8 Add guarded `comment`, idempotent verified `follow`, and idempotent verified `unfollow` using the generic `bili_jct` form binding, with unit tests that prove Cookie values never enter adapter-visible data.
- [x] 4.9 Flatten Bilibili source files into one package-owned site directory, remove its nested workspace/package artifacts, generate the installed manifest from typed command metadata, and update catalog build, release, documentation, and tests.
- [x] 4.10 Move the built-in Bilibili source to `packages/sites/src/bilibili`, compile catalog and site code from one TypeScript source root, and update build, packaging, documentation, and validation coverage.

## 5. Documentation and Compatibility

- [x] 5.1 Document English and Simplified Chinese raw fetch usage, origin/referer customization, adapter format, add/remove/list commands, Bilibili usage, trust boundaries, and Chrome Host Permission prerequisites.
- [x] 5.2 Add Chrome/Edge compatibility coverage describing Partial versus Forwarded claims and confirm agent-browser 0.33.0, Browser Use 0.13.7, and Playwright CLI 0.1.17 boundaries are unchanged.
- [x] 5.3 Attempt raw custom-header/cookie fetch and `panerelay fetch bilibili me` in an existing daily Chrome session; if a matching fetch-capable Extension is unavailable, record that reason and leave unverified claims classified conservatively.
- [x] 5.4 Update English and Simplified Chinese documentation, help examples, RFC/compatibility matrices, command inventory, package layout, CSRF boundary, and explicit `login`/`download` exclusions.
- [x] 5.5 Rebuild and reload lockstep components, reinstall Bilibili, and validate representative read, form-CSRF write/cleanup, help, table, and JSON behavior in the existing daily Chrome without retaining credentials or machine-specific output.

## 6. Validation and Cleanup

- [x] 6.1 Run focused protocol, Bridge, Extension, CLI, setup, and Bilibili adapter typechecks/tests and fix all failures.
- [x] 6.2 Run `pnpm install --frozen-lockfile`, `pnpm run check`, `openspec validate add-browser-fetch-adapters --strict`, and `git diff --check`.
- [x] 6.3 Inspect the final diff for generated screenshots, browser logs, cookies, credentials, request bodies, temporary adapter installations, and machine-specific verification artifacts; remove any such files before handoff.
- [x] 6.4 Run all focused tests plus `pnpm install --frozen-lockfile`, `pnpm run check`, strict OpenSpec validation, `git diff --check`, and a final credential/artifact hygiene review.
