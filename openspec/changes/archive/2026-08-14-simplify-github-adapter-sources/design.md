## Context

See [proposal.md](./proposal.md). Setup currently distinguishes fixed built-in IDs, existing local directories, and explicit GitHub repository sources. GitHub `#subdirectory` is exact, and RFC-0009 intentionally forbids recursive repository discovery. The requested syntax must shorten common cases without turning unknown input into ambient network lookup or weakening archive validation.

## Goals / Non-Goals

**Goals:**

- Resolve a known built-in plus explicit ref from Panerelay's official public repository.
- Resolve one-segment GitHub selectors through a small ordered set of conventional adapter paths.
- Keep source provenance canonical, commit-pinned, credential-free, and reproducible.
- Preserve local path precedence, batch atomicity, and all existing extraction and build limits.
- Avoid unauthenticated GitHub API rate limits when a local Git executable is available.

**Non-Goals:**

- Recursive repository search, globbing, manifest indexes, Git clone/checkout, private repositories, tokens, credential helpers, submodules, or dependency installation.
- Guessing a remote repository for an unknown adapter ID.
- Changing adapter runtime authority, browser ownership, agent-browser 0.33.0, or any browser compatibility group.

## Decisions

### Parse official built-in refs only after local-path resolution

`<id>@<ref>` becomes an official-source alias only when `<id>` exists in the supplied built-in catalog. Exact built-in IDs keep their current packaged behavior. Existing local directories and explicit local path forms retain precedence, so a real local directory named `zhihu@main` is not reinterpreted as remote.

The alias is normalized to repository `F-loat/panerelay`, requested ref, and `packages/sites/src/<id>` before using the ordinary GitHub resolver. Unknown `<id>@<ref>` values fail without network access.

Alternatives considered:

- Treating any `<id>@<ref>` as GitHub was rejected because it reintroduces ambient remote discovery for unknown names.
- Adding a separate `--official-ref` flag was rejected because it is longer and composes poorly in multi-source batches.

### Resolve only one-segment selectors through an ordered candidate list

A `#<name>` selector checks, in order:

1. `<name>`
2. `sites/<name>`
3. `adapters/<name>`
4. `packages/sites/src/<name>`
5. `packages/sites/<name>`
6. `src/sites/<name>`

A candidate matches only when the directory directly contains `panerelay.site.ts` or `panerelay-fetch-adapter.json`. The first match wins, as explicitly selected by the user. Multi-segment selectors remain exact and never enter discovery. If no candidate matches, the error reports the bounded attempted paths.

This fixed list is deterministic and auditable. Recursive traversal was rejected because it increases archive work, makes priority dependent on repository contents, and can select unintended code after an upstream layout change.

### Record the resolved canonical subdirectory

GitHub provenance stores the actual matched path, not the one-segment alias. Reinstalling still resolves the named ref to one commit before extraction, and diagnostics can explain exactly which source was installed.

### Prefer Git for read-only ref resolution

When `git` is available, Setup invokes `git ls-remote` with an explicit public HTTPS GitHub URL and argument array to resolve the selected ref to a full commit. It does not clone, fetch into a local repository, checkout, execute hooks, initialize submodules, or consult credential helpers. The Git child receives terminal prompting disabled and no credential-helper configuration. Named refs resolve deterministically across an exact ref, branch, peeled annotated tag, and tag; a caller-supplied full commit remains its own immutable identity. When Git is unavailable, Setup retains the unauthenticated GitHub API path. A Git execution or lookup failure does not silently switch transports.

The codeload request remains pinned to the resolved SHA, so source download, archive bounds, path selection, build, validation, atomic installation, and provenance are identical across the two ref-resolution transports.

### Ignore bounded GitHub global PAX metadata

Real GitHub codeload tarballs include a global PAX metadata entry before the repository root. The extractor counts and size-bounds this entry, ignores its body without applying attributes, and then establishes the repository root from the first ordinary file or directory. Links and every other unsupported tar entry type remain rejected.

The official repository currently exceeds the old 2,048-entry extraction ceiling. The ceiling is raised to 4,096 while the compressed-byte, expanded-byte, per-file, path-depth, and file-type bounds remain unchanged; an archive with 4,097 entries still fails closed.

### Record the durable exception in RFC-0011

RFC-0011 supersedes only RFC-0009's exact-subdirectory-only rule. The GitHub transport, archive bounds, no-execution build, atomic installation, and browser-neutral behavior remain unchanged. The RFC stays Accepted until the code ships; it is not marked Implemented by this change.

## Risks / Trade-offs

- [A repository adds a higher-priority matching directory] → Commit-pinned provenance prevents an existing install from changing; reinstall behavior follows the documented priority, and users can supply the exact multi-segment path.
- [The official repository or built-in layout changes] → Keep the official repository and source-root constants tested together with the catalog; fail before installation on a missing source.
- [A ref alias resembles a local name] → Resolve existing local directories first and restrict the alias to catalog IDs.
- [Candidate probing leaks repository layout in errors] → Report only the fixed bounded candidate strings, never an extracted machine path or directory listing.
- [Git inherits ambient authentication or prompts] → Force a public HTTPS URL, disable terminal prompts and credential helpers, pass arguments without a shell, and sanitize failures.

## Migration Plan

The syntax is additive. Existing built-in, local, full GitHub, ref, and exact-subdirectory commands retain their behavior. Rollback removes the alias and candidate resolver; existing installed adapters remain usable because registry provenance and installed artifacts do not depend on future source parsing.
