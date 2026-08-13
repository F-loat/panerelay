## 1. Source resolution

- [x] 1.1 Add a catalog-gated `<built-in-id>@<ref>` parser that maps known built-ins to the official repository and canonical source subdirectory after local-path resolution.
- [x] 1.2 Add fixed-priority one-segment GitHub adapter selection across the documented common paths while keeping multi-segment subdirectories exact.
- [x] 1.3 Record the resolved canonical subdirectory in GitHub provenance and return bounded errors for unknown aliases or unmatched selectors without recursive discovery.
- [x] 1.4 Accept and ignore bounded global PAX metadata emitted by real GitHub codeload archives without weakening link or entry rejection.
- [x] 1.5 Raise the bounded archive-entry ceiling to 4,096 so the official repository can be installed.
- [x] 1.6 Prefer non-interactive, credential-free `git ls-remote` ref resolution when Git is available and retain API fallback only for Git-unavailable systems.

## 2. Automated coverage

- [x] 2.1 Add parser and resolver tests for official aliases, refs, exact paths, all common candidates, multiple-match priority, canonical provenance, and no-match errors.
- [x] 2.2 Add install-flow tests proving unknown `<id>@<ref>` performs no network request and existing built-in, local, GitHub, archive-safety, and atomic-batch behavior remains unchanged.
- [x] 2.3 Add a regression test for GitHub codeload global PAX metadata handling.
- [x] 2.4 Prove archives above the new 4,096-entry ceiling still fail closed.
- [x] 2.5 Add ref-resolution tests for Git preference, branch/tag selection, full commits, unavailable-Git API fallback, sanitized failures, and no clone/checkout behavior.

## 3. Documentation and verification

- [x] 3.1 Update Setup help/README with the short commands and document the fixed candidate priority.
- [x] 3.2 Complete RFC-0011 and keep RFC-0009's unaffected security, build, provenance, and runtime decisions authoritative.
- [x] 3.2a Reconcile RFC-0011 with the explicit decision to prefer Git for public ref resolution without cloning.
- [x] 3.3 Build local Setup, install Zhihu through both `zhihu@main` and `F-loat/panerelay#zhihu`, run a non-mutating Zhihu command through daily Chrome, inspect canonical provenance, and restore the intended local adapter installation.
- [x] 3.4 Run package-scoped tests and typechecks, strict OpenSpec validation, `pnpm run check`, and `git diff --check`.
