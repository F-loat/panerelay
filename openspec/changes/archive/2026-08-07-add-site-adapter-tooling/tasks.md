## 1. Architecture and Protocol

- [x] 1.1 Amend RFC-0009 with the source/installed format split, public site-kit boundary, static build rules, GitHub resolution and trust model, registry provenance, alternatives, and unchanged browser/domain-policy ownership decisions.
- [x] 1.2 Add backward-compatible local, built-in, and GitHub adapter provenance types, validators, bounds, registry tests, and credential/path rejection coverage to `@panerelay/protocol`.

## 2. Public Site Toolkit

- [x] 2.1 Create the lockstep publishable `@panerelay/site-kit` package with public author types, `defineSite`, `defineCommand`, programmatic check/build APIs, package-runner CLI metadata, README, license, and focused API/CLI tests.
- [x] 2.2 Implement bounded source discovery, TypeScript AST literal-metadata extraction, duplicate/path/import validation, and controlled typechecking without importing adapter modules or reading repository build configuration.
- [x] 2.3 Implement the generic one-shot adapter runtime and deterministic generated entry/bundle pipeline that emits and revalidates only `panerelay-fetch-adapter.json` plus `adapter.mjs`.
- [x] 2.4 Implement `init`, temporary-output `check`, explicit bounded `test`, and protected `build --out` behavior with overwrite, cleanup, exit-code, help, and version tests.
- [x] 2.5 Add adversarial toolkit fixtures for non-literal metadata, unsafe paths, unsupported package imports, source side effects, package scripts, malformed commands, duplicate IDs, output containment, deterministic rebuilds, and packed standalone consumption.

## 3. Built-in Catalog Migration

- [x] 3.1 Migrate Bilibili to `panerelay.site.ts` and public per-command definitions, retain only site-specific `client.ts`/shared helpers, and remove its private `manifest.ts`, `commands/index.ts`, and protocol `index.ts`.
- [x] 3.2 Make `@panerelay/sites` build and validate Bilibili exclusively through site-kit while preserving the aggregate catalog API and two-file packed inventory.
- [x] 3.3 Port Bilibili unit/fixture tests to the public toolkit test context and prove all 19 command names, metadata, output order, WBI behavior, CSRF declarations, and generated manifest fields remain unchanged.

## 4. Setup Source and GitHub Installation

- [x] 4.1 Add deterministic source classification for built-ins, existing local paths, strict two-file sources, site-kit sources, GitHub shorthand, canonical GitHub URLs, refs, and subdirectories without turning unknown bare IDs into network lookups.
- [x] 4.2 Implement bounded unauthenticated GitHub repository/default-branch/commit resolution and HTTPS codeload retrieval with normalized credential-free provenance and injectable transport tests.
- [x] 4.3 Implement bounded archive streaming/extraction with redirect, timeout, compressed/expanded byte, entry-count, file-size, depth, path traversal, link, device, and cleanup safeguards plus adversarial archive fixtures.
- [x] 4.4 Build source-form adapters in protected temporary staging, validate every mixed batch before commit, store optional provenance atomically with digest/manifest state, preserve old registries, and remove every download/build directory on success or failure.
- [x] 4.5 Localize English and Simplified Chinese source/GitHub help, trust guidance, progress, resolved-commit results, failures, and remediation; add parser, lifecycle, no-network, no-secret, batch-atomicity, and installed-list tests.

## 5. Distribution and Documentation

- [x] 5.1 Add site-kit and its dependency edges to workspace lockfile, release inventory, version preparation, beta rewriting, packed dependency checks, candidate order, publish order, and release tests without publishing.
- [x] 5.2 Add an isolated packed-tarball author smoke test that installs protocol/site-kit, initializes, checks, tests, and builds a minimal adapter without workspace links or repository package scripts.
- [x] 5.3 Document source layout, one-command-per-file authoring, local edit/check/test/build/reinstall, two-file compatibility, GitHub shorthand/URL/ref/path publishing, public-only constraints, provenance, trust, removal, and offline fallback in English and Simplified Chinese.
- [x] 5.4 Update compatibility records to keep browser fetch conservative, record setup GitHub support separately from browser execution, and confirm agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, and Playwright CLI 0.1.17 claims are unchanged.

## 6. Validation and Cleanup

- [x] 6.1 Run focused protocol, site-kit, sites, setup, CLI registry, release, source fixture, and packed-consumer typechecks/tests and fix every failure.
- [x] 6.2 Rebuild lockstep components, reinstall the migrated Bilibili artifact from source, and run representative help, table, JSON, read, and CSRF-safe write/cleanup commands in the existing daily Chrome without retaining credentials or machine-specific output.
- [x] 6.3 Run agent-browser, Browser Use, and Playwright regression suites to confirm source tooling and setup network resolution did not alter browser ownership or engine integration behavior.
- [x] 6.4 Run `pnpm install --frozen-lockfile`, `pnpm run check`, `pnpm run release:check`, strict OpenSpec validation, packed-artifact inspection, and `git diff --check`.
- [x] 6.5 Inspect the final diff for source archives, generated adapters, temporary checkouts/builds, screenshots, browser logs, cookies, tokens, request bodies, machine paths, and other verification artifacts; remove them before handoff.
