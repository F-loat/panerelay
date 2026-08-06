## 1. Public Commands

- [x] 1.1 Add side-effect-free `-v` and `--version` handling to `panerelay` while preserving child arguments after `--`, and advertise both aliases in localized help
- [x] 1.2 Add side-effect-free `-v` and `--version` handling to `panerelay-setup` and advertise both aliases in localized help
- [x] 1.3 Standardize both public commands on version-only `v<semver>` output without command-name prefixes

## 2. Public Surface Cleanup

- [x] 2.1 Remove the four machine-oriented npm `bin` declarations and delete the unreferenced standalone agent-browser executable
- [x] 2.2 Restore Playwright adapter, Native Host, and Host installer entry points to machine/internal-only behavior while preserving their supported call paths
- [x] 2.3 Update release package expectations for the reduced agent-browser artifact set

## 3. Verification Coverage

- [x] 3.1 Make the manifest-driven executable audit assert exactly the two public commands and exercise all four metadata aliases without setup side effects
- [x] 3.2 Preserve CLI passthrough coverage so `-h`, `--help`, `-v`, and `--version` after `panerelay run --` remain child arguments
- [x] 3.3 Run focused builds and tests for affected packages and verify internal integration wiring remains covered
- [x] 3.4 Update executable-level assertions for exact `v<semver>` output and rerun validation

## 4. Compatibility and Final Validation

- [x] 4.1 Review agent-browser 0.33.0 compatibility documentation and daily-Chrome applicability; record no matrix change or real-browser rerun because no browser/runtime behavior changes
- [x] 4.2 Run the frozen install, full workspace check, strict OpenSpec validation, and `git diff --check`, then clean up any isolated test artifacts
