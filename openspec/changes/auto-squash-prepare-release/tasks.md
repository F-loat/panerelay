## 1. Workflow merge gate

- [x] 1.1 Expose the exact preparation commit SHA from the branch commit step and the generated pull-request URL from the PR creation step.
- [x] 1.2 Add a bounded check-discovery and check-watch gate that waits for pull-request checks, fails on failed/cancelled/timeout states, and leaves the PR open when validation does not pass.
- [x] 1.3 Add a non-admin `gh pr merge --squash --delete-branch` step pinned with `--match-head-commit`, while preserving the existing scoped workflow permissions and separate stable publication gate.

## 2. Contract and operator guidance

- [x] 2.1 Update `scripts/release.test.mjs` to assert check waiting, exact-head protection, squash merge, branch cleanup, and the absence of administrator bypass.
- [x] 2.2 Update `docs/releasing.md` to describe the automatic PR check gate, squash merge result, failure recovery, and the unchanged manual `Release → stable` publication step.
- [x] 2.3 Validate the OpenSpec change and keep the main release specification delta aligned with the implemented workflow behavior.

## 3. Verification and handoff

- [x] 3.1 Run the targeted release tests, formatting checks, and `git diff --check`.
- [x] 3.2 Run the repository-required frozen install and full `pnpm run check`.
- [x] 3.3 Confirm the change is workflow/documentation-only with no runtime browser or agent-browser compatibility impact; no daily-Chrome acceptance run or compatibility record update is required.
- [x] 3.4 Retain the isolated worktree and report the repository-settings prerequisite and the safe real-run observation plan.
