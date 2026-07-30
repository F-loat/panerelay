## Why

Panerelay has verified local release tooling but no maintainer-facing publication workflow, so publishing four lockstep npm packages and the Extension archive still depends on a fragile sequence of local commands. A manually triggered GitHub Action should make stable and beta publication repeatable while keeping credentials, approval, and immutable version selection explicit.

## What Changes

- Add one manually triggered release workflow with `stable` and `beta` channels.
- Publish all four public `@panerelay` packages in dependency order, using npm `latest` for stable releases and npm `beta` for beta releases.
- Keep the repository version authoritative for stable releases.
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

The change affects GitHub Actions, release scripts and tests, package/version preparation, release documentation, and the stable distribution specification. It requires GitHub repository write permission and npm publication credentials in a protected environment. Runtime packages, the shared protocol, browser permissions, Extension control behavior, and agent-browser compatibility semantics are unchanged.
