## Why

The official Chrome Web Store listing is now the safest and simplest installation path, while the README still directs normal users through Developer mode and GitHub Release archives. Public GitHub Releases also expose candidate-internal inventory and a checksum list that references npm tarballs not attached to the Release.

## What Changes

- Make the official Chrome Web Store listing the default Extension installation path in user-facing English and Chinese guidance.
- Print an actionable Extension next step after setup: the Store link for the official ID and matching-build guidance for custom IDs.
- Keep unpacked Extension loading for development, self-built distributions, rollback, and manual candidate verification.
- Keep the complete Extension zip, `inventory.json`, and full `SHA256SUMS` in GitHub Actions artifacts for audit and publication recovery.
- Limit stable GitHub Release assets to the verified Extension zip and a public checksum file that names only attached assets.
- Add release-contract coverage for the public asset boundary and Store-first documentation.
- Non-goals: automate Chrome Web Store submission, change Extension identity, change browser ownership or authorization, alter agent-browser behavior, or remove candidate inventory.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `stable-distribution`: Make the Chrome Web Store the default user installation path while retaining unpacked flows for development and exceptional cases.
- `release-automation`: Separate complete internal workflow artifacts from the minimal public GitHub Release asset set.

## Impact

The change affects the root READMEs, setup CLI and package guidance, release checklist, GitHub Release workflow, and release/setup contract tests. It does not change the setup operation itself, the official Extension ID, browser-process ownership boundaries, or the agent-browser `0.33.0` minimum and verified compatibility group.
