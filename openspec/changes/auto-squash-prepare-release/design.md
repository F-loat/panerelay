## Context

See `proposal.md` and the `release-automation` delta spec for the motivation and observable behavior. The current Prepare Release job performs the full workspace and release-candidate checks before committing metadata, then creates a pull request and stops. It already requests `contents: write` and `pull-requests: write`, while the repository currently allows squash merges and has no protection configured on `main`.

The generated branch is a same-repository branch created by the workflow. The existing `CI` workflow runs on its pull request and the latest real preparation PR completed its Linux and Windows matrix checks successfully.

## Goals / Non-Goals

**Goals:**

- Keep the version change reviewable as a pull request and retain its CI result as a second merge gate.
- Wait for check runs to appear and finish before attempting the merge.
- Merge only the exact commit pushed by the current workflow invocation, using squash semantics.
- Let GitHub branch rules and merge conflicts reject the merge normally.

**Non-Goals:**

- Do not use `--admin`, a personal access token, or a new external action to bypass GitHub policy.
- Do not change the protected `Release` workflow, npm trusted publishing, Chrome Web Store publication, browser ownership, or the agent-browser `0.33.0` compatibility group.
- Do not change CI to `pull_request_target` or otherwise grant untrusted pull-request code elevated execution context.

## Decisions

### Wait for the generated pull request's checks explicitly

After the branch push, the commit step exposes its exact `HEAD` SHA. The PR creation step exposes the created URL. A follow-up step polls `gh pr checks --json` until at least one check is reported, then runs `gh pr checks --watch --fail-fast` so any reported check failure stops the job. The initial poll is necessary because `gh pr checks --watch` exits immediately when the event-triggered CI has not registered a check run yet.

The workflow does not use `--required`: the repository currently has no protected required-check configuration, while the release gate needs to observe the actual CI matrix on the generated PR. This also makes a future required-check policy additive; branch protection still decides whether GitHub accepts the merge.

### Use an exact-commit, non-admin squash merge

Once checks pass, call `gh pr merge` with `--squash`, `--delete-branch`, and `--match-head-commit` set to the commit step's output. The command uses the workflow's short-lived `GITHUB_TOKEN`, which already has the required scoped write permissions. Omitting `--admin` means required reviews, required checks, merge queues, conflicts, and repository policy remain authoritative. If the head changed or the merge is otherwise rejected, the workflow fails without modifying `main`.

The workflow deliberately waits for checks before invoking the merge rather than enabling GitHub auto-merge. Explicit waiting makes the success/failure boundary visible in the Prepare Release run and guarantees that the chosen squash operation is attempted only after the checks observed by the run are complete.

### Keep the stable publication gate separate

The squash merge only changes the lockstep version metadata on `main`. It does not grant npm OIDC permission, enter the `release` environment, publish tarballs, create a tag, or create a GitHub Release. The operator must still dispatch `Release` with `stable` after the merged commit is on `main`.

## Risks / Trade-offs

- **A PR check never starts or requires human workflow approval** → Poll for a bounded period, fail closed, and leave the PR open; do not merge without the observed CI gate.
- **A later actor changes the preparation branch** → Pin `--match-head-commit` to the validated SHA so a different commit cannot be merged by this run.
- **A check passes but a new optional check appears after the watch begins** → The merge remains subject to GitHub's current branch rules; the local pre-commit gates also validate the exact metadata content before the branch is pushed.
- **Automatic merge removes a maintainer's final review opportunity** → Keep the generated PR, visible check wait, exact metadata allowlist, and fail-closed merge policy; the remaining human gate is the protected stable publication workflow.
- **GitHub repository settings do not allow the token to merge** → The merge step fails with no administrator fallback. The repository must retain `contents: write` and `pull-requests: write` for this feature.

## Migration Plan

1. Merge the workflow, test, documentation, and OpenSpec changes into `main`.
2. Run Prepare Release once with a disposable patch/minor target only after confirming the current release preconditions; observe that the PR CI checks finish and the resulting `main` commit is a single squash commit.
3. Confirm that npm packages and stable GitHub Release state remain unchanged until the separate `Release` workflow is dispatched.
4. Roll back by removing the check-wait and merge steps; any already-created version PR can be reviewed and merged manually.
