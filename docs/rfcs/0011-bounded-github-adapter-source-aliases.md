# RFC-0011: Bounded GitHub adapter source aliases

- RFC: 0011
- Title: Bounded GitHub adapter source aliases
- Status: Accepted
- Authors: F-loat
- Created: 2026-08-13
- Updated: 2026-08-13
- OpenSpec: `openspec/changes/simplify-github-adapter-sources`

## Summary

Panerelay Setup accepts two shorter forms for explicitly requested public GitHub adapter sources. A known built-in ID followed by `@<ref>` resolves that adapter from the official `F-loat/panerelay` repository. A one-segment `#<name>` selector on any explicit GitHub repository checks a fixed ordered list of conventional adapter directories and selects the first adapter-shaped match.

This RFC supersedes RFC-0009 where it requires every GitHub subdirectory to be exact and where it forbids invoking Git for ref resolution. It does not change public-GitHub-only access, commit pinning, archive bounds, site-toolkit build, validation, atomic installation, provenance, no-execution guarantees, or the browser authority model.

## Motivation

Installing an unreleased built-in currently exposes the monorepo path:

```text
github:F-loat/panerelay@main#packages/sites/src/zhihu
```

The desired user-facing form is:

```text
zhihu@main
```

Third-party monorepositories also commonly place adapters in a small number of predictable directories. Requiring every user to know the full layout adds friction without improving authority when the repository and optional ref are already explicit.

## Goals and non-goals

Goals:

- shorten explicit installs for unreleased built-in adapters;
- support deterministic common-path selection for explicit public GitHub repositories;
- keep every installed remote source pinned to one resolved commit and canonical subdirectory;
- preserve the rule that unknown bare IDs do not cause network access.

Non-goals:

- recursive discovery, globs, registry search, arbitrary repository inference, private GitHub credentials, Git execution, hooks, submodules, package installation, or repository scripts;
- changing adapter code execution, browser session authority, tab control, or automation-engine behavior.

## Source forms

Setup recognizes `<built-in-id>@<ref>` only when the ID exists in its lockstep catalog. It maps the source to:

```text
github:F-loat/panerelay@<ref>#packages/sites/src/<built-in-id>
```

Existing local directories win before this alias is considered. An unknown `<id>@<ref>` fails without a network request.

For an explicit GitHub source with a one-segment selector, Setup checks only:

1. `<name>`
2. `sites/<name>`
3. `adapters/<name>`
4. `packages/sites/src/<name>`
5. `packages/sites/<name>`
6. `src/sites/<name>`

A candidate is adapter-shaped only when it directly contains `panerelay.site.ts` or `panerelay-fetch-adapter.json`. The first matching candidate wins. A selector containing `/` remains an exact repository-relative path. No other directory is inspected.

## Security and privacy

- The repository remains explicit, except for known built-ins whose official repository is fixed by Setup.
- Every ref resolves once to a full commit before archive download. When available, local Git performs only non-interactive `ls-remote` against an explicit public HTTPS URL with credential helpers disabled; otherwise Setup uses the unauthenticated GitHub API.
- Setup never clones, checks out, initializes submodules, executes hooks, or places a Git repository on disk.
- Archive extraction retains the existing byte, entry, depth, file-type, traversal, and symlink limits.
- A bounded GitHub codeload global PAX metadata record is ignored and never applied to extracted files.
- The entry-count ceiling is 4,096 so the official monorepo fits while oversized repositories still fail closed.
- Candidate checks read only the fixed paths inside the bounded temporary extraction.
- No adapter or repository script runs during source resolution.
- Errors may name the fixed candidates but do not expose temporary local paths or repository contents.

## Compatibility and migration

The source syntax is additive. Existing built-in IDs, local paths, GitHub URLs, owner/repository shorthand, refs, and multi-segment exact subdirectories remain unchanged. Ref resolution prefers local Git when available, with the API retained for Git-less systems. Existing registrations need no migration because installed artifacts already retain a resolved commit and source provenance.

The feature is platform-neutral Setup behavior. It does not change Chrome, Edge, agent-browser 0.33.0, Browser Use, Playwright, or any browser compatibility classification.

## Alternatives considered

### Recursively search for matching adapter IDs

Rejected because repository growth can change selection, traversal cost is less bounded, and unrelated directories become part of source resolution.

### Reject multiple matches

Rejected by explicit product choice. A documented priority makes short selection predictable; callers who need another match can use its exact multi-segment subdirectory.

### Add a new command-line flag for official refs

Rejected because `<built-in-id>@<ref>` is shorter, batch-friendly, and remains unambiguous when restricted to catalog IDs.

## Acceptance criteria

- `zhihu@main` resolves only because `zhihu` is a known built-in and records the official repository, requested ref, full commit, and canonical source path.
- `F-loat/panerelay#zhihu` selects `packages/sites/src/zhihu` using the documented priority list.
- Multiple matches select the earliest candidate.
- Unknown built-in aliases cause no network request.
- Multi-segment selectors remain exact.
- Existing GitHub archive safety and atomicity tests remain green.
