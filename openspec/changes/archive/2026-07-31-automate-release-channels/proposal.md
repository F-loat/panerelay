## Why

Panerelay has verified publication automation, but stable version preparation still requires maintainers to update several lockstep package and Extension fields manually before the Release workflow can run. A separate manually triggered preparation workflow should calculate a selected major, minor, or patch increment, validate it, and open a reviewable pull request without weakening the existing protected publication boundary.

## What Changes

- Add one manually triggered release workflow with `stable` and `beta` channels.
- Add a separate manually triggered Prepare Release workflow that selects a major, minor, or patch increment with minor as the default, validates the complete version change, and opens a pull request.
- Publish all four public `@panerelay` packages in dependency order, using npm `latest` for stable releases and npm `beta` for beta releases.
- Keep the merged repository version authoritative for stable releases; preparation SHALL NOT publish packages, create a tag, or modify the default branch directly.
- Derive a unique beta version during the workflow, apply it only to the runner workspace, and never commit or push beta version changes.
- Build and retain a downloadable Extension zip for both channels.
- Create a stable Git tag and GitHub Release with the Extension zip, inventory, and checksums only for the stable channel.
- Use protected release credentials and fail before publication when the selected version or tag already exists.
- Preserve the existing non-publishing candidate and CI commands.
- Keep agent-browser `0.33.0` as the minimum and only initially verified compatibility group.
- Do not change browser attachment, authorization, control ownership, supported browser-process capabilities, or Chrome Web Store publication.

## Capabilities

### New Capabilities

- `release-automation`: Defines manual stable and beta publication, ephemeral beta versioning, npm distribution tags, downloadable Extension artifacts, and stable GitHub Releases.

### Modified Capabilities

- `stable-distribution`: Generalizes lockstep candidate identity so a stable repository version and an ephemeral beta workflow version can both be validated without weakening stable release gates.

## Impact

The change affects GitHub Actions, release scripts and tests, package/version preparation, release documentation, and the stable distribution specification. Preparation requires scoped GitHub contents and pull-request write permission; publication separately requires protected npm credentials. Runtime packages, the shared protocol, browser permissions, Extension control behavior, and agent-browser compatibility semantics are unchanged.
