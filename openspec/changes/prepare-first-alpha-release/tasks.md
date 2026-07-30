## 1. Release identity and package metadata

- [x] 1.1 Add a checked release descriptor for `0.1.0-alpha.1`, its numeric Chrome version, pinned agent-browser 0.33.0, and the four publishable packages
- [x] 1.2 Align root, package, and Extension versions while keeping the workspace root and Extension package private
- [x] 1.3 Add complete public package metadata, runtime file lists, documentation, and license coverage to protocol, agent-browser, Bridge, and setup
- [x] 1.4 Validate that packed internal dependencies resolve to the exact lockstep alpha version and contain no workspace-only references

## 2. Candidate creation and isolated smoke testing

- [x] 2.1 Add a shared non-publishing release tool that builds npm tarballs and an unpacked-Extension archive in an isolated output directory
- [x] 2.2 Generate and validate a machine-readable inventory with artifact sizes and SHA-256 checksums
- [x] 2.3 Inspect tarball and Extension contents for required exports, executables, Native Host bundle, Skill, manifest, and UI assets
- [x] 2.4 Install all tarballs in a temporary consumer project and exercise setup help, install, doctor, update, and uninstall against disposable user state
- [x] 2.5 Add automated failure coverage for version drift, incomplete package contents, workspace references, and unsupported setup platforms

## 3. CI and operator guidance

- [x] 3.1 Add root `release:check` and retained `release:pack` commands without any publish, tag, upload, or credential path
- [x] 3.2 Run credential-free release readiness in CI on Node.js 20 and 22
- [x] 3.3 Update README and setup guidance with the alpha Extension loading, installation, authorization, Provider selection, diagnosis, update, rollback, and uninstall workflow
- [x] 3.4 Add a release checklist covering clean-tree prerequisites, candidate inspection, compatibility evidence, checksums, and separately authorized external publication
- [x] 3.5 Keep agent-browser 0.33.0 compatibility groups and daily-browser ownership limitations explicit
- [x] 3.6 Add an explicitly invoked alpha npm publication command with package-level prepublish builds

## 4. Verification and completion

- [x] 4.1 Run package-focused tests for release tooling, setup, Bridge installation, and Extension packaging
- [x] 4.2 Run `pnpm run check`, `pnpm run release:check`, `openspec validate --all --strict`, and `git diff --check`
- [x] 4.3 Produce one retained local candidate and verify its inventory and checksums without committing artifacts
- [ ] 4.4 Reinstall from the packed setup candidate, reload the unpacked Extension candidate, and verify doctor plus one agent-browser 0.33.0 local-fixture control session in the daily Chrome profile
- [ ] 4.5 Remove temporary consumer, browser, and candidate state; record remaining alpha gaps; sync and archive the completed OpenSpec change

> Stable-release reconciliation: 4.4 is deferred to `prepare-first-stable-release` task 8.4. Task 4.5 is deferred to stable tasks 8.7 and 8.8. This change remains active until that real-browser evidence and cleanup are complete.
