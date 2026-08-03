## 1. Workflow merge gate

- [x] 1.1 Expose the exact preparation commit SHA from the branch commit step and the generated pull-request URL from the PR creation step.
- [x] 1.2 Add a bounded check-discovery and check-watch gate that waits for pull-request checks, fails on failed/cancelled/timeout states, and leaves the PR open when validation does not pass.
- [x] 1.3 Add a non-admin `gh pr merge --squash --delete-branch` step pinned with `--match-head-commit`, while preserving the separate stable publication boundary.
- [x] 1.4 Wait for the exact squash merge to reach the default branch, preserve its SHA, and dispatch `Release` with channel `stable` using the workflow token.

## 2. Contract and operator guidance

- [x] 2.1 Update `scripts/release.test.mjs` to assert check waiting, exact-head protection, squash merge, branch cleanup, source-SHA handoff, and the absence of administrator bypass.
- [x] 2.2 Update `docs/releasing.md` to describe the automatic PR check gate, squash merge result, exact-source stable dispatch, and failure recovery.
- [x] 2.3 Validate the OpenSpec change and keep the main release specification delta aligned with the implemented workflow behavior.

## 3. Verification and handoff

- [x] 3.1 Run the targeted release tests, formatting checks, and `git diff --check`.
- [x] 3.2 Run the repository-required frozen install and full `pnpm run check`.
- [x] 3.3 Confirm the change is workflow/documentation-only with no runtime browser or agent-browser compatibility impact; no daily-Chrome acceptance run or compatibility record update is required.
- [x] 3.4 Retain the isolated worktree and report the repository-settings prerequisite and the safe real-run observation plan.

## 4. Review follow-ups

- [x] 4.1 Preserve the squash-merge SHA through Prepare Release and validate the exact checked-out Release source and GitHub Release target.
- [x] 4.2 Add manual recovery guidance for a post-merge propagation or dispatch failure.
- [x] 4.3 Strengthen the workflow regression test so stable dispatch follows merge propagation confirmation.
