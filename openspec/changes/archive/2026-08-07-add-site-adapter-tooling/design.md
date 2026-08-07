## Context

See `proposal.md` for motivation and the delta specs for observable behavior. The archived browser-fetch change established two distinct forms that currently share the word adapter: editable built-in TypeScript under `packages/sites/src/<site>`, and the protected installed form containing only `panerelay-fetch-adapter.json` plus one self-contained `.mjs` entry. The catalog build that connects them is package-private, imports Bilibili source to generate metadata, and includes Bilibili's stdin/stdout entrypoint in site code.

OpenCLI demonstrates the ergonomics we want: its aggregate npm package ships `clis/<site>/<command>.js`, command metadata lives beside each handler, and user overrides are source files rather than one npm package per site. Panerelay cannot copy that runtime layout directly without discarding its static help, digest, bounded-child, and atomic-install boundaries. This design therefore makes source authoring lightweight while retaining a generated installed form.

RFC-0009 remains authoritative for browser fetch, child execution, protected registry storage, local-adapter trust, and deferred domain policy. It needs an amendment for source compilation, provenance, and explicit GitHub retrieval; the Bridge and Extension protocol do not change.

## Goals / Non-Goals

**Goals:**

- Give built-in and third-party adapters one documented source contract with one command per file.
- Remove the site-specific manifest generator and stdin/stdout entrypoint from Bilibili.
- Make source checking and building deterministic, reusable, and safe to invoke during setup without executing source modules.
- Support explicit, reproducible public GitHub installs without creating one npm package per site.
- Retain the existing installed manifest, executable, registry, help, and child-execution contracts.

**Non-Goals:**

- A marketplace, central index, search service, ratings, dependency resolver, package manager, or automatic update daemon.
- Private GitHub authentication, GitLab or arbitrary Git hosts, SSH, Git submodules, Git LFS, or repository package dependencies in the first version.
- A sandbox for code the user explicitly installs. Static build avoids install-time execution, but the installed adapter retains ordinary user-process authority when a command is invoked.
- Changes to Chrome Host Permission, future domain ACLs, tab authorization, browser selection, control leases, or browser-process automation.
- Upgrading compatibility claims. Browser fetch remains classified by RFC-0009 and its compatibility record; agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, and Playwright CLI 0.1.17 require regressions only.

## Decisions

### 1. Separate the source contract from the installed contract

A source site has this conventional shape:

```text
panerelay.site.ts
commands/<command>.ts
commands/**/*.test.ts       # optional, test-only
<relative shared modules>   # optional
```

`panerelay.site.ts` uses `defineSite(...)` to declare literal `id`, `name`, `version`, and `description` metadata. Every direct command module exports one `defineCommand(...)` value containing literal help metadata and one handler. The handler receives a typed invocation context, including the fetch client, and parsed adapter arguments. Relative modules and `node:` built-ins are allowed; the only allowed package import is the public site-kit API. Tests are excluded from production discovery.

The toolkit parses the TypeScript syntax tree and accepts only statically evaluable metadata nodes. It never imports a site or command module to discover a manifest. It typechecks through a controlled compiler host that supplies the site-kit API declarations, so a standalone source directory needs neither `package.json` nor `tsconfig.json`. It then generates an internal entry module, bundles the declared graph and runtime, and validates the resulting two-file source through `@panerelay/protocol`.

Alternative considered: install the source tree and load command files at runtime like OpenCLI. That is smaller but would replace the one-entry digest with a mutable multi-file runtime, require help discovery to load source or duplicate metadata, and weaken the installed boundary already accepted in RFC-0009. Alternative considered: require every adapter to publish a prebuilt npm package. That recreates the distribution weight the aggregate catalog was meant to avoid.

### 2. Publish site-kit as both an API and a package-runner CLI

`@panerelay/site-kit` exports `defineSite`, `defineCommand`, author-facing types, the generated adapter runtime, and programmatic `checkSite`/`buildSite` functions. Its package executable supports:

```text
npx --yes @panerelay/site-kit init <directory> --id <site>
npx --yes @panerelay/site-kit check <directory>
npx --yes @panerelay/site-kit test <directory>
npx --yes @panerelay/site-kit build <directory> --out <directory>
```

`init` writes only the site definition, one example command, and a short README. `check` builds into an owned temporary directory and discards it. `test` bundles discovered `*.test.ts` files and runs them with Node's test runner in a bounded child; because tests are arbitrary author code, only this explicit developer action executes them. `build` refuses a non-empty output directory unless it already contains only a prior toolkit-owned two-file output for the same source.

The package owns TypeScript parsing/typechecking and esbuild bundling. Setup consumes its programmatic API; it does not spawn `npx`, resolve another version, or duplicate build rules. `@panerelay/sites` also calls the API. This keeps lockstep behavior identical in workspace, packed setup, and third-party development.

Alternative considered: expose only a CLI and have setup spawn it. That would add nested process/version resolution and make atomic error handling harder. Alternative considered: place the build API in `@panerelay/sites`. That would make external tooling depend on the official catalog and blur source tooling with catalog inventory.

### 3. Remove Bilibili's private protocol scaffolding

Bilibili moves its site identity to `panerelay.site.ts`; each existing command file becomes one `defineCommand` export. Site-kit discovery replaces `manifest.ts` and `commands/index.ts`, while its generated runtime replaces `index.ts`. `client.ts` and `_shared` remain because they contain genuinely site-specific API and reused command logic, not adapter protocol plumbing. Bilibili tests use the public toolkit loader/test context so the built-in proves the external API is sufficient.

This is the concrete second implementation behind the runtime extraction deferred by RFC-0009: the previous manual Bilibili entry and the generated generic entry now establish which plumbing is actually shared.

### 4. Resolve GitHub sources through bounded HTTPS API and archive downloads

Source classification is deterministic:

1. A built-in ID resolves from `@panerelay/sites`.
2. An existing local directory wins over shorthand parsing.
3. `github:<owner>/<repo>`, `<owner>/<repo>`, or `https://github.com/<owner>/<repo>` is an explicit public GitHub source.
4. Anything else fails locally without network access.

GitHub sources accept a documented ref and subdirectory in explicit suffix/query fields. Setup resolves an omitted ref to the repository's default branch, resolves the selected ref to a full commit through the unauthenticated GitHub API, downloads the matching codeload archive over HTTPS with redirect, time, and byte limits, and extracts it through an archive reader that rejects links, devices, absolute paths, traversal, excessive entries, and oversized files. It does not invoke `git`, inherit credential helpers, or accept tokens, which makes the public-only boundary enforceable and consistent across platforms.

At the selected directory, exact two-file form wins; otherwise `panerelay.site.ts` selects source form. Repository-wide recursive adapter discovery is intentionally absent: a root with multiple possible sites requires an explicit subdirectory. Resolved provenance is `{ kind, locator, commit }`, contains no query credentials, and is recorded in the optional registration field.

Alternative considered: shallow `git clone`. It is familiar and handles more refs, but adds a Git executable dependency, difficult pack-size bounds, credential/helper ambiguity, and platform-specific behavior. Alternative considered: download a branch archive without resolving a commit. That makes installed provenance float and cannot explain exactly what was installed.

### 5. Extend registry provenance compatibly and retain the atomic transaction

`FetchAdapterRegistration` gains an optional validated `source` field so existing registries remain readable. Built-ins record their catalog ID and lockstep version; local paths record a normalized absolute path; GitHub records the canonical public locator and 40-character resolved commit. The field is descriptive and update-oriented, not an authorization grant. CLI execution continues to validate the manifest, path, mode, digest, and generation exactly as before and does not fetch or rebuild anything.

Setup resolves, downloads, and builds every requested source into separate protected temporary directories before it creates the existing installation staging tree. Only after all generated two-file sources validate does the current registry replacement occur. Every failure removes download/build staging and leaves active entries unchanged. Reinstalling the same manifest version with different bytes remains an explicit replacement whose new digest and provenance commit together.

Alternative considered: keep provenance in a separate lockfile. A second atomic file would introduce disagreement with the authoritative registry and is unnecessary for bounded optional metadata.

### 6. Keep dependency and execution boundaries narrow

Source builds may bundle source-relative modules, the site-kit runtime, and allowed `node:` built-ins. They reject arbitrary package imports and never read or run repository `package.json` scripts. TypeScript compiler transformers, esbuild config files/plugins, and custom build hooks are unsupported. The generated adapter remains a one-shot Node child and receives only the existing invocation and fetch-session data.

Setup's remote fetch is a new network surface, but only the explicit GitHub forms reach it. URL parsing rejects credentials and non-HTTPS schemes; errors contain normalized repository identity without response bodies or tokens. Neither setup nor site-kit reads browser state. RFC-0009's local-code trust warning expands to remote code and states that inspection/build-time non-execution does not sandbox later command execution.

### 7. Add site-kit to lockstep release order

Site-kit depends on protocol; sites depends on protocol plus site-kit; setup depends on CLI, sites, and site-kit. Release metadata, temporary beta rewriting, inventory, packed dependency rewriting, isolated consumer tests, and publication order include the new package. Release validation scaffolds and builds a tiny adapter only from packed tarballs, and catalog tests prove Bilibili uses the same API.

No release is performed by this change. RFC-0009 remains `Accepted`; per repository policy it is not marked `Implemented` until released.

## Risks / Trade-offs

- [TypeScript and bundler dependencies make site-kit heavier than raw OpenCLI command files] → Keep them in one tooling package, keep installed adapters self-contained, inspect packed size, and avoid one package per site.
- [Static metadata parsing can feel restrictive] → Limit only help/site metadata to literals; handlers and shared runtime logic remain ordinary TypeScript, with precise diagnostics for unsupported expressions.
- [GitHub's unauthenticated API is rate-limited or unavailable] → Use requests only for explicit remote installs, report rate/reset metadata without response bodies, support immutable local/two-file sources as an offline fallback, and leave installed adapters unaffected.
- [A downloaded archive can exhaust disk or parser resources] → Bound redirects, response bytes, entry count, expanded bytes, path depth, and individual files; stream into an owned temporary directory and clean in `finally`.
- [Remote adapter code is malicious] → Require explicit installation, display trust guidance and resolved commit, avoid build-time execution and dependency scripts, retain digest checks and child isolation, and make the no-sandbox limitation explicit.
- [Source and installed formats drift] → Put all source parsing and generation in site-kit, consume the same API from setup and sites, and verify packed cross-package workflows.

## Migration Plan

1. Publish protocol-compatible site-kit, migrated sites, setup, CLI, and release metadata in one lockstep candidate.
2. Existing installed adapters and existing local two-file sources continue to work without migration because registry provenance is optional.
3. Migrate Bilibili to the public source contract and compare generated manifest/command inventory plus representative behavior before removing its private entry and manifest generator.
4. Document source initialization, local reinstall/test, GitHub publication, explicit commit/ref pinning, trust, and removal in English and Simplified Chinese.
5. Rollback reinstalls the previous lockstep packages. Adapters installed from source or GitHub remain ordinary compatible two-file installations; older readers ignore optional provenance only if their strict registry validator is updated in the same release, otherwise setup can remove and reinstall them before rollback.
