## 1. OpenCode Runtime Selection

- [x] 1.1 Add bounded `override` / `discovered` OpenCode path-origin validation to the protected runtime configuration, treating missing or invalid legacy metadata as discovered.
- [x] 1.2 Separate explicit and persisted-fallback OpenCode candidates so reconstructed PATH and documented local discovery stop before touching a stale fallback once a live candidate succeeds.
- [x] 1.3 Make Native Host setup/self-update write the selected origin and make live OpenCode provider discovery preserve explicit overrides while refreshing automatic or legacy selections.

## 2. Regression Coverage and Compatibility

- [x] 2.1 Add executable-resolution regressions for explicit override precedence, live PATH precedence, persisted fallback, deduplication, and no stale probe after a live success.
- [x] 2.2 Add runtime-config, Native Host installation/migration, and OpenCode provider descriptor regressions covering legacy records and Codex-selected all-provider discovery behavior.
- [x] 2.3 Update the browser compatibility record without upgrading Chrome or Edge beyond Forwarded or changing agent-browser 0.33.0 claims.

## 3. Validation and Local Repair

- [x] 3.1 Run formatting plus scoped Bridge tests and typechecks for the changed runtime-selection surfaces.
- [x] 3.2 Run `pnpm run check`, strict OpenSpec validation, and `git diff --check` in the worktree.
- [x] 3.3 Install the repaired development Native Host and verify a bounded local all-provider discovery selects OpenCode 1.18.12 without new Gatekeeper events or changes to user sessions and credentials.
- [x] 3.4 Confirm daily Chrome Side Panel acceptance with Codex selected.
