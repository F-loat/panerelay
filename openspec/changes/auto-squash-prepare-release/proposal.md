## Why

`Prepare Release` already validates the calculated lockstep version and candidate before it creates a version pull request, but the workflow stops at that pull request and requires a maintainer to approve and merge a metadata-only change. The generated pull request's CI can run without changing the release candidate, so the workflow can finish the same validated path with a guarded squash merge and automatically dispatch the stable publication workflow as a separate publication gate.

## What Changes

- Wait for all checks reported on the generated version pull request to complete.
- Fail closed when a pull-request check fails, is cancelled, or does not finish before the preparation job times out.
- Squash merge the generated pull request into the repository default branch only after the workflow's local release gates and pull-request checks pass.
- Pin the merge to the exact preparation commit and delete the temporary remote branch after a successful merge.
- Wait until the squash merge is visible on the default branch, then dispatch `Release` with channel `stable`.
- Update release documentation and automated workflow assertions to describe the new merge behavior.

Non-goals:

- Do not bypass branch protection, required checks, merge queues, or environment approvals with administrator privileges.
- Do not publish npm packages, create stable tags or GitHub Releases, or submit to the Chrome Web Store directly from `Prepare Release`; dispatch the separate `Release` workflow only after the guarded merge.
- Do not change browser attachment, authorization, control ownership, protocol behavior, or the agent-browser `0.33.0` compatibility boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-automation`: The validated version pull request is automatically squash-merged into the default branch after its checks pass; failures leave the pull request open and do not modify the default branch.

## Impact

- Affected workflow: `.github/workflows/prepare-release.yml`.
- Affected release tests and operator guidance: `scripts/release.test.mjs` and `docs/releasing.md`.
- GitHub repository settings must continue to grant the workflow `actions: write`, `contents: write`, and `pull-requests: write`; all normal branch-protection and merge-queue rules remain authoritative.
- Stable publication remains a separate workflow job dispatched automatically after the merge and still uses the `release` environment and npm trusted publishing configuration.
