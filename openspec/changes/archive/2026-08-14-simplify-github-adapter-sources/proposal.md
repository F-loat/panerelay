## Why

Installing an unreleased built-in adapter currently requires users to know Panerelay's GitHub repository and its internal monorepo path. Explicit third-party GitHub sources also require a full subdirectory even when the caller supplies an adapter name that appears in a conventional repository layout.

## What Changes

- Accept `<built-in-id>@<ref>` in `setup add`, resolving that built-in from the official public `F-loat/panerelay` repository at the selected branch, tag, or commit.
- Accept a one-segment GitHub adapter selector such as `F-loat/panerelay#zhihu` and resolve it against a documented, finite ordered list of common source locations.
- Select the first adapter-shaped match when multiple common locations match, with the exact root-relative selector receiving highest priority.
- Prefer an available local `git ls-remote` for public ref-to-commit resolution, falling back to the unauthenticated GitHub API only when Git is unavailable; no clone or checkout is performed.
- Preserve existing exact subdirectory behavior, local-path precedence, bounded archive extraction, commit-pinned provenance, batch atomicity, and the rule that unknown bare IDs never trigger network access.
- Update Setup help, tests, RFC documentation, and compatibility documentation for the new source forms.
- Do not clone repositories, consult Git credential helpers, recursively search repositories, support private GitHub credentials, execute repository scripts, change browser ownership, or alter agent-browser 0.33.0 compatibility groups.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `fetch-site-adapters`: Extend explicit GitHub adapter source resolution with official built-in ref aliases and deterministic bounded common-path selection.

## Impact

- Affects `packages/setup` GitHub parsing, resolution, help text, tests, and provenance behavior.
- Adds RFC-0011 to supersede only RFC-0009's exact-subdirectory-only source-selection rule; RFC-0009 remains authoritative for adapter format, validation, isolation, and installation.
- Does not change the Bridge, Extension, CLI adapter invocation protocol, site-kit source contract, browser control, or automation engines.
