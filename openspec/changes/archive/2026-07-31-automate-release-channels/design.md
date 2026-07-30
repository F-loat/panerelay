## Context

See `proposal.md` for motivation and the two delta specs for observable behavior. The repository currently has a non-publishing candidate builder that validates lockstep package metadata, creates four npm tarballs and one Extension zip, runs a packed setup lifecycle, and records checksums and source identity. CI exercises that path on Linux and Windows, but maintainers still publish and create releases manually.

The publication path must preserve the security and ownership decisions in RFC-0001 and RFC-0002. This change does not alter runtime protocol, browser access, Chrome attachment, or agent-browser coverage: 0.33.0 remains the minimum and only initially Verified compatibility group.

## Goals / Non-Goals

**Goals:**

- Make stable and beta publication one explicit manual GitHub Actions operation.
- Make the selected next major, minor, or patch stable identity one explicit, reviewable preparation pull request.
- Publish the exact tarballs accepted by candidate validation rather than repacking source.
- Keep beta version edits ephemeral, deterministic, and recoverable on every exit path.
- Make a partially completed npm publication safe to retry when registry integrity matches.
- Prefer short-lived npm trusted-publishing credentials and attach provenance.

**Non-Goals:**

- Automatically merge a version-preparation pull request or publish from an unmerged version.
- Commit beta metadata, create beta tags or releases, or upload beta builds to Chrome Web Store.
- Publish from normal CI, pull requests, or pushes.
- Change browser-process limitations, authorization, control leases, supported Agent behavior, or compatibility labels.
- Make four npm publications atomic; npm exposes no multi-package transaction.

## Decisions

### Prepare Release creates a version pull request

Add `.github/workflows/prepare-release.yml` as a separate `workflow_dispatch` workflow. It runs only from the current default branch, verifies that the repository's current version already has both a stable tag and GitHub Release, and offers `major`, `minor`, and `patch` increments with `minor` selected by default. From `X.Y.Z`, the respective semantic targets are `(X+1).0.0`, `X.(Y+1).0`, and `X.Y.(Z+1)`; the Chrome numeric version appends `.0` to the selected target. Requiring evidence that the current version was released prevents a second preparation run after the new version PR merges from advancing another version before publication. Target tag, Release, branch, pull request, and all four npm versions must remain unused before preparation can write Git state.

A tested Node helper updates only the release metadata allowlist: the root manifest, four publishable package manifests, Extension package manifest, Extension manifest, and release descriptor. The workflow installs the frozen dependency graph, runs the full quality and release gates, creates `release/prepare-<version>` with commit `chore(release): prepare <version>`, and opens a pull request against the default branch.

The preparation job receives only `contents: write` and `pull-requests: write`; it receives no npm OIDC permission and never uses the protected `release` environment. Repository settings must allow GitHub Actions to create pull requests. GitHub-generated pull requests may require a maintainer to approve their CI runs before merge, which preserves a human review boundary without introducing a long-lived PAT.

Directly committing the version to the default branch was rejected because it bypasses pull-request review and branch protection. Bumping inside the stable publication job was rejected because retries could skip a version and the published candidate would not originate from an already merged source commit.

### One protected manual workflow owns both channels

Add `.github/workflows/release.yml` with a required `stable`/`beta` choice, repository-wide release concurrency, a `release` environment, `contents: write`, and `id-token: write`. Candidate preparation runs on a GitHub-hosted Ubuntu runner with the workspace's Node 20.19 floor, installs the pinned pnpm version with the frozen lockfile, and runs the full quality gate. The isolated publication job uses Node 22.14 or newer and npm 11.5.1 or newer as required by npm trusted publishing; this does not change the packages' Node 20 runtime floor.

The stable channel is accepted only from the default branch. The beta channel may use the ref explicitly selected in the manual workflow UI, and its inventory records the exact commit. This keeps feature testing possible without giving beta runs durable Git state.

Using one workflow is preferred to separate stable and beta files because npm trusted-publisher configuration binds to an exact workflow filename and each package can have only one trusted publisher.

### Stable uses repository metadata; beta temporarily overlays it

Stable preparation reads the plain semantic version and Chrome numeric version already committed in `release.config.json`.

Beta identity is `<stable>-beta.<run-number>`. Its Chrome `version_name` uses the same identity, while its numeric `version` uses `<stable-major>.<stable-minor>.<run-number>.<run-attempt>`. Every numeric component must fit Chrome's 16-bit component limit. The run number advances public beta releases, while the run attempt distinguishes downloaded Chrome builds without exposing CI retry mechanics as another npm prerelease level.

A Node release-channel helper snapshots the small allowlist of release metadata files, asserts that the checkout was clean before beta preparation, writes the temporary identity, invokes the existing candidate builder, and restores the files in `finally`. Candidate inventory records `channel`, the selected commit, and the pre-overlay clean state. Package documentation is made channel-neutral in source instead of being rewritten per beta.

Alternatives rejected:

- `npm version` because it can create tags and touches lockfile state not needed for packing.
- Committing beta bumps because they add noisy history and merge conflicts.
- Leaving the Chrome numeric version unchanged because downloaded beta builds would be visually indistinguishable in Chrome.

### Candidate tarballs are the publication unit

The workflow publishes the `.tgz` files recorded in the verified candidate, not the workspace directories. This guarantees that npm receives the same dependency pins and contents inspected by release validation, and lets the beta helper restore source metadata before any external write.

A publication helper reads each packed manifest, enforces candidate version and package order, computes SHA-512 SRI, and queries npm before publishing. Missing versions are published with `latest` or `beta`; existing byte-identical versions are skipped so a partial attempt can resume; conflicting integrity fails closed. Publication remains sequential because downstream packages reference the exact protocol and Bridge version.

Trusted publishing is preferred to a long-lived `NPM_TOKEN`. Each of the four npm packages must authorize this repository and `.github/workflows/release.yml`; the workflow receives OIDC through `id-token: write`. Public packages from the public repository then receive npm provenance automatically.

### Action artifacts precede external publication

After candidate validation, `actions/upload-artifact` uploads only the Extension zip, `inventory.json`, and `SHA256SUMS` under `panerelay-extension-<version>`. Both channels therefore expose the requested downloadable plugin even if a later publication step fails. The four npm tarballs remain local workflow inputs and are distributed through npm rather than duplicated in the downloadable Extension artifact.

### Stable release is the final stable-only side effect

Before npm publication, stable preflight rejects an existing remote tag or GitHub Release. After npm publication succeeds, `gh release create` targets the workflow commit, creates `v<version>`, generates notes with a Panerelay compatibility preface, and attaches the exact Extension zip, inventory, and checksums. Beta has no step with Git write or Release API authority beyond the job's unused permission.

Chrome Web Store submission remains manual and uses the same downloaded stable Extension zip.

## Risks / Trade-offs

- **A package publishes before a later package fails** → Compare registry SRI with candidate bytes and safely resume only identical packages.
- **Trusted publisher is not configured for all four packages** → Document the exact one-time npm configuration; publication fails without falling back to a long-lived token.
- **A beta numeric Chrome version sorts above a later stable archive** → Beta is a downloadable developer build, not a Chrome Web Store update channel; stable Store submission remains independently versioned in source.
- **Action major tags can change implementation over time** → Use official GitHub-maintained actions and keep Dependabot/review responsible for major upgrades; the release scripts retain content and integrity validation.
- **Artifact upload succeeds but npm publication fails** → The run remains failed, the downloadable diagnostic candidate remains available, and a retry reuses the same beta package version so identical published tarballs can be resumed safely.
- **Stable npm publication succeeds but GitHub Release creation fails** → Rerun safely integrity-matches npm packages and retries only the missing GitHub release.
- **Repository settings reject Action-created pull requests** → Fail before publication and document the one-time GitHub Actions permission setting.
- **Action-created pull-request CI awaits approval** → Keep the PR unmerged until a maintainer approves and reviews its checks.
- **Preparation runs after an untagged version was merged** → Require a matching tag and GitHub Release for the current version before calculating another increment.

## Migration Plan

1. Merge the preparation workflow and helpers to the default branch; normal CI remains non-publishing.
2. Allow GitHub Actions to create pull requests, run Prepare Release, approve its CI if requested, and merge the reviewed version PR.
3. Create a protected GitHub environment named `release` and require maintainer approval.
4. Configure npm trusted publishing for each `@panerelay` package with repository `F-loat/panerelay` and workflow filename `release.yml`.
5. Run one beta workflow and verify npm `beta`, the downloaded zip, inventory, checksums, provenance, and unchanged Git refs.
6. Run stable only after the existing release checklist passes; verify npm `latest`, tag, GitHub Release, and assets.
7. Roll back preparation by disabling its manual workflow. Published npm versions and stable tags remain immutable; fixes use a new version.
