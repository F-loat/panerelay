## Why

Panerelay is ready to prepare its first stable `0.1.0` candidate, but the current README leads with architecture instead of the two user outcomes that make the project valuable. The release surface should make those outcomes immediately understandable while preserving the exact security, compatibility, and evidence boundaries already recorded for the candidate.

## What Changes

- Reframe the English and Simplified Chinese READMEs around two primary workflows:
  - let any Agent use standard agent-browser commands against explicitly authorized tabs in the user's existing Chrome profile, including its current login state;
  - connect supported local Agent providers in the browser side panel with minimal setup.
- Keep both READMEs evergreen: describe product capabilities without embedding the current release number, artifact filename, provider inventory, or agent-browser compatibility baseline. Record those version-bound facts in release notes, the release checklist, and compatibility records.
- Make the quickstart lead directly from Extension installation to local setup, user authorization, agent-browser verification, and side-panel chat.
- Keep setup, update, diagnostics, custom Extension ID, development, and operating-boundary information concise and discoverable.
- Audit stable `0.1.0` version identity, release documentation, compatibility evidence, and local candidate checks without publishing packages, creating a Git tag, uploading artifacts, or changing an accepted release gate.

Non-goals:

- This change does not claim that every Agent runtime is bundled or verified; each release remains limited to the providers implemented and named by its release materials.
- This change does not widen site permissions, tab authorization, debugger ownership, or the exclusive control-lease model.
- This change does not add browser-process capabilities such as isolated profiles, launch-time proxy changes, or closing the user's Chrome process.
- This change does not publish the immutable `0.1.0` packages or create the `v0.1.0` release.

The pinned browser automation baseline remains agent-browser `0.33.0`. The affected compatibility groups are Provider selection, browser-level handshake, page and tab automation, control-session lifecycle, side-panel provider sessions, and stable distribution.

## Capabilities

### New Capabilities

None. This is a documentation and release-readiness change, so `.openspec.yaml` opts out of delta specs.

### Modified Capabilities

None. Existing capability requirements and release gates remain unchanged.

## Impact

- Top-level English and Simplified Chinese README positioning and quickstart structure.
- Stable-release documentation and metadata only when inconsistencies are found.
- Local release validation through existing `release:check`, packed-candidate, and workspace checks.
- No protocol, Bridge, Extension permission, provider, or agent-browser command behavior changes.
