## 1. Channel-aware candidate tooling

- [x] 1.1 Generalize release metadata validation and inventory for explicit stable and beta channels while preserving stable defaults
- [x] 1.2 Add deterministic beta npm and Chrome version derivation with strict numeric and semantic validation
- [x] 1.3 Add a release-channel command that temporarily overlays beta metadata, builds a retained candidate, emits workflow outputs, and restores source files on success or failure
- [x] 1.4 Add unit and integration tests for stable identity, beta derivation, lockstep metadata, clean-source enforcement, and restoration

## 2. Exact candidate publication

- [x] 2.1 Add a publisher that reads candidate tarballs in dependency order, verifies manifest identity and SHA-512 integrity, and selects `latest` or `beta`
- [x] 2.2 Make registry preflight and publication retries skip only byte-identical existing packages and fail closed on conflicts
- [x] 2.3 Add offline tests for ordered publication plans, integrity matching, conflicts, and channel tags without writing to npm

## 3. GitHub Actions workflow

- [x] 3.1 Add a protected, serialized `workflow_dispatch` workflow with `stable` and `beta` inputs, frozen installation, full validation, and npm trusted publishing
- [x] 3.2 Upload the exact Extension zip, inventory, and checksums as a versioned Actions artifact for both channels
- [x] 3.3 Enforce default-branch and remote tag/release preflight for stable, then create the stable Git tag and GitHub Release only after npm publication succeeds
- [x] 3.4 Ensure beta has no commit, push, tag, GitHub Release, or Chrome Web Store side effect

## 4. Documentation and verification

- [x] 4.1 Make package release guidance channel-neutral and document release environment, npm trusted-publisher setup, manual dispatch, outputs, retry behavior, and Chrome Web Store boundaries
- [x] 4.2 Confirm agent-browser 0.33.0 compatibility claims and browser ownership/security behavior are unchanged; update no compatibility group without new evidence
- [x] 4.3 Run focused release tests, workflow syntax checks, `pnpm install --frozen-lockfile`, `pnpm run check`, stable and beta dry-run candidates, strict OpenSpec validation, and `git diff --check`
- [ ] 4.4 Download and load a workflow-built beta Extension zip in daily Chrome, verify its displayed beta identity and normal authorization/revocation, and remove temporary browser state and artifacts
- [x] 4.5 Keep the public npm beta identity at one run-number ordinal across workflow retries

## 5. Stable version preparation

- [x] 5.1 Add a deterministic next-minor release metadata helper and CLI with lockstep, overflow, and malformed-version tests
- [x] 5.2 Add a Prepare Release workflow with default-branch, released-base, target-conflict, validation, commit, push, and pull-request gates
- [x] 5.3 Make stable release guidance version-neutral and document Prepare Release, Action-created pull-request permission, CI approval, merge, and publication order
- [x] 5.4 Add workflow contract tests proving preparation cannot publish, tag, mutate the default branch directly, or weaken the protected Release workflow
- [x] 5.5 Run focused preparation tests, full repository checks, stable candidate validation, strict OpenSpec validation, and `git diff --check`
- [ ] 5.6 Run Prepare Release from GitHub, approve and inspect its generated version pull request, and confirm no npm package, tag, Release, or Store side effect occurs before merge
