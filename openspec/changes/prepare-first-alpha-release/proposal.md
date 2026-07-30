## Why

Panerelay's core browser relay, setup flow, side panel, and control-session lifecycle now work in
development, but the repository still uses placeholder versions and private package metadata.
The first alpha needs a reproducible, locally verifiable distribution unit before any npm or
GitHub release is attempted.

## What Changes

- Establish one lockstep `0.1.0-alpha.1` version across the Extension and publishable
  `@panerelay` packages.
- Make the protocol, agent-browser Provider, Bridge, and setup packages packable with complete
  public-package metadata while keeping the workspace root and Extension package private.
- Add a deterministic release check that builds the Extension bundle and npm tarballs, validates
  their contents and dependency versions, and smoke-tests setup from packed artifacts without
  publishing anything.
- Add a packaged unpacked-Extension archive and machine-readable checksums for local inspection or
  a future GitHub prerelease.
- Add an explicitly invoked alpha npm publication command that builds and publishes the four
  packages in dependency order.
- Run release checks in CI and document the alpha installation, diagnosis, update, rollback, and
  known-limitations workflow.
- Keep agent-browser pinned to 0.33.0 and preserve its current compatibility classifications.

Non-goals:

- Do not publish from CI or candidate-generation commands, create a GitHub Release, upload to
  Chrome Web Store, or push tags automatically.
- Do not add Windows Native Messaging support, automatic Extension installation, background
  updates, signing, telemetry, or a hosted update service.
- Do not add backward protocol negotiation; the first alpha is a lockstep Extension/package
  distribution and mismatched builds continue to fail closed.
- Do not expand browser ownership, site permission, tab authorization, or unsupported
  browser-process capabilities.

## Capabilities

### New Capabilities

- `alpha-distribution`: Defines a lockstep, reproducible release candidate with verified npm
  tarballs, an unpacked-Extension archive, setup smoke tests, explicit npm publication, and
  operator guidance.

### Modified Capabilities

None.

## Impact

- Workspace and package manifests: versions, publishability, package metadata, dependency
  boundaries, and release scripts.
- Extension: manifest version and packaged archive generation; browser permissions are unchanged.
- Setup and Bridge: packed-artifact installation and recovery smoke coverage on supported local
  platforms.
- CI: an additional non-publishing release-readiness job or step.
- Documentation: root quickstart, package guidance, release checklist, and alpha limitations.
- Compatibility: agent-browser 0.33.0 remains the pinned automation baseline across connection,
  page automation, target/state, diagnostics/network/emulation, Provider options, and
  control-session activity groups.
