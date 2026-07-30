## Context

See `proposal.md` for motivation and `specs/alpha-distribution/spec.md` for observable behavior. The workspace currently builds five internal packages and one unpacked Manifest V3 Extension, but uses placeholder package versions, marks every package private, and verifies only source builds. The setup package already bundles the Native Host and Agent Skill, so the main uncertainty is whether the published dependency graph and packaged files work without workspace links.

RFC-0001 through RFC-0003 continue to govern protocol, authorization, browser ownership, side-panel Agents, and control-session behavior. The agent-browser 0.33.0 compatibility matrix remains the version-specific capability record.

## Goals / Non-Goals

**Goals:**

- Produce one inspectable alpha candidate from a clean source tree without external writes.
- Detect version, dependency, export, executable, and package-content drift before publication.
- Exercise the packed setup lifecycle in a disposable home and consumer project.
- Keep npm publication a separately authorized mechanical step that rebuilds each package.

**Non-Goals:**

- Do not provide a general monorepo release manager or automatic semantic-version selection.
- Do not promise byte-for-byte reproducible archives across operating systems.
- Do not introduce a compatibility shim between different Panerelay protocol builds.
- Do not test or support browser-process capabilities excluded by RFC-0002.

## Decisions

### Use one checked release descriptor and lockstep package versions

The root semantic version is the alpha release identity. Publishable packages carry that exact version and use workspace dependencies that pack to exact internal versions. A small release descriptor records the numeric Chrome version mapping and the pinned agent-browser version.

Chrome manifest versions cannot contain prerelease text, so the Extension uses a numeric `version` and exposes the semantic release through `version_name`. The release check validates both instead of pretending the two version syntaxes are identical.

Independent package versioning was rejected for the first alpha because the protocol, Bridge, Provider, and setup package are deployed as one compatibility unit.

### Publish libraries and CLI packages, distribute the Extension separately

`@panerelay/protocol`, `@panerelay/agent-browser`, `@panerelay/bridge`, and `@panerelay/setup` become public-packable packages. The workspace root and `@panerelay/extension` remain private. Package manifests include their runtime files, exports, executables, engine requirement, license, repository metadata, and public access intent.

The Extension is built as an unpacked archive for manual loading during alpha. Chrome Web Store packaging and signing remain separate because they require external accounts and review.

### Separate candidate creation from candidate validation

A packaging command writes a versioned directory under an ignored artifact root for maintainers who need inspectable output. A release-check command uses a disposable directory and removes it after validation. Both share one implementation and never invoke npm publish, GitHub APIs, or git tagging.

The candidate inventory includes artifact names, sizes, and SHA-256 checksums. Checksums prove the inspected candidate's integrity; they are not a cross-platform reproducibility promise.

### Smoke-test tarballs as an isolated consumer

The release check installs all packed Panerelay packages into a temporary consumer project so package-manager resolution cannot fall back to workspace links. It runs the setup CLI help and a setup/doctor/update/uninstall lifecycle against a disposable home with generated non-secret stub executables.

Testing only `pnpm pack` output was rejected because a valid-looking tarball can still contain workspace dependency references, omit a bundled Native Host, or fail when its binary is invoked.

### Keep CI credential-free

CI runs source checks and release validation on Node.js 20 and 22. It does not upload the candidate or receive publication credentials. Actual npm publication, GitHub prerelease creation, tag creation, and Extension distribution require an explicit later request and a clean tagged commit.

### Mirror the package-native npm publication flow

The root alpha publication command filters the four public packages and delegates to `pnpm publish`. Each package uses `prepublishOnly` to rebuild immediately before publication, while pnpm packs workspace dependencies as released versions. The command forwards the `alpha` dist-tag and the maintainer-provided npm OTP.

A custom registry client was rejected because pnpm already provides package ordering, workspace dependency rewriting, git checks, lifecycle hooks, and npm authentication behavior.

## Risks / Trade-offs

- **npm packing semantics change** → Inspect the generated package manifests and install all tarballs as a consumer on every CI run.
- **The setup smoke test mutates a developer profile** → Override home, project, and executable paths with a disposable fixture and assert cleanup.
- **Chrome's numeric version diverges from SemVer** → Keep the mapping in the release descriptor and validate `version_name` against the root version.
- **Artifact archives include machine-specific build output** → Build from repository sources, list allowed contents, and reject unexpected workspace references; do not claim bitwise reproducibility.
- **Lockstep releases increase package churn** → Accept the cost for alpha while protocol negotiation is absent, then revisit independent versioning after a compatibility RFC.
- **CI duration grows** → Reuse the normal build output and keep the consumer smoke local and credential-free.

## Migration Plan

1. Add release metadata and align the alpha versions.
2. Make the four runtime packages public-packable and verify their dependency graph.
3. Add candidate creation, inventory, checksum, and isolated install smoke tooling.
4. Add CI and documentation coverage.
5. Run the normal and release checks, then inspect one retained local candidate.
6. Roll back by restoring private package metadata and removing release tooling; installed local integrations remain removable through the existing setup CLI.
