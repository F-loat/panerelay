## 1. Simplify the executable surface

- [x] 1.1 Remove `browser clear`, `connection resolve`, and `run` from CLI parsing, dispatch, operation types, localized errors, and built-in alias precedence.
- [x] 1.2 Delete the `run`-only child-process runner and concurrency-lock modules, tests, and public exports while preserving shared browser-registry and adapter-resolution APIs.
- [x] 1.3 Replace top-level help with concise bilingual common usage plus base Setup and `setup add` guidance.

## 2. Align tests and durable documentation

- [x] 2.1 Add parser/help tests proving the removed commands fail without side effects and the setup-first help remains bilingual.
- [x] 2.2 Update CLI, Setup, and integration documentation to remove obsolete wrapper, clear-command, and temporary-install examples.
- [x] 2.3 Amend RFC-0007 to make direct Browser Use invocation and gateway concurrency authoritative, with the resolver retained only as internal integration machinery.
- [x] 2.4 Update the published Panerelay Skill and multi-browser routing contract to use the Setup-provided global CLI and Extension-owned default clearing.

## 3. Verify and clean up

- [x] 3.1 Run CLI/package tests and confirm the local built CLI renders the new help and rejects all three removed commands.
- [x] 3.2 Run `pnpm run check`, strict OpenSpec validation, and `git diff --check`.
- [x] 3.3 Verify against the connected daily Chrome that supported `browsers`/Connect discovery remains available and that removed commands create no browser participant or control state, then close only the exact verification session.
- [x] 3.4 Confirm no generated browser logs, screenshots, runtime state, or other verification artifacts were added to the repository.
- [x] 3.5 Confirm current user-facing guidance and main specs contain no temporary `npx @panerelay/cli` path or removed-command recommendation.
