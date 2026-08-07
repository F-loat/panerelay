## Why

Panerelay's built-in Bilibili adapter now has a clear command-per-file source layout, but external authors still have to reverse-engineer the private catalog build or hand-produce a manifest and bundle. A public source toolkit and explicit GitHub installation path can keep authoring as light as OpenCLI while preserving Panerelay's validated two-file installed boundary.

## What Changes

- Add a public lockstep `@panerelay/site-kit` package with a typed, command-per-file source contract and `init`, `check`, `test`, and `build` commands for source adapters that do not need their own npm package, handwritten manifest, or build configuration.
- Let `@panerelay/setup add` accept either the existing two-file install source or a site-kit source directory. Source directories are compiled in a temporary staging area before the existing atomic validation and installation transaction, so authors can edit source and reinstall without publishing or manually building it.
- Let setup resolve explicit public GitHub repository sources using owner/repository shorthand or canonical GitHub URLs, with optional immutable refs and repository subdirectories. Remote source resolution records the resolved commit and never runs repository package managers, lifecycle scripts, or arbitrary build commands.
- Keep built-ins in the aggregate `@panerelay/sites` package, migrate its Bilibili build to the public site-kit API, and use the same source contract that third-party authors receive.
- Preserve compatibility with existing local two-file adapters and installed registries. Help and adapter execution continue to use the generated static manifest and self-contained `.mjs` entry.
- Add localized setup help, resolution errors, source validation output, and trust guidance for local source and GitHub installation.
- Add `@panerelay/site-kit` to stable/beta package inventory, packed-consumer validation, lockstep version preparation, and dependency-ordered publication.
- Keep installation explicit and fail closed. This change does not add an adapter marketplace, search/index service, npm package-per-site distribution, automatic updates, private Git credential management, dependency installation, package-script execution, or runtime loading of TypeScript.
- Keep browser ownership unchanged: site tooling and installation do not grant Chrome Host Permission, authorize a tab, select a browser, create an automation participant, or acquire a control lease. Installed commands still use the existing browser-fetch and domain-policy boundaries.

## Capabilities

### New Capabilities

- `site-adapter-development`: Define the reusable source layout, typed authoring API, scaffolding, validation, deterministic build output, and local development workflow for fetch site adapters.

### Modified Capabilities

- `fetch-site-adapters`: Accept validated source-form local adapters and explicit public GitHub sources while retaining atomic protected installation and the strict installed artifact contract.
- `setup-cli-localization`: Localize source-tooling and GitHub adapter lifecycle help, trust guidance, errors, and results.
- `stable-distribution`: Include the public site-kit package and its packed author workflow in lockstep release validation.
- `release-automation`: Publish site-kit in the dependency-ordered stable and beta package plan.

## Impact

- Adds `packages/site-kit` and affects `packages/sites`, `packages/setup`, release metadata/scripts, root and package documentation, OpenSpec main specs, and the browser-fetch/site-adapter RFC.
- Uses the existing Node.js 20 runtime floor and pnpm workspace. The toolkit may own build-time bundling dependencies, but remote repositories cannot trigger dependency installation or lifecycle scripts.
- Adds bounded network access to setup only when the user explicitly supplies a GitHub source. Built-in IDs and local paths remain offline.
- Does not change the accepted Bridge/Extension fetch transport, credential binding, adapter child protocol, installed registry protection, or deferred domain-level authorization decision.
- Does not change agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, or Playwright CLI 0.1.17 behavior; their compatibility groups require regression coverage only.
