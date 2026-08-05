## 1. Organize Bridge Provider Sources

- [x] 1.1 Move the shared Provider contract and runtime-specific Provider modules into `packages/bridge/src/providers/` with Codex, Claude Code, ACP, Qoder, and OpenCode subdirectories.
- [x] 1.2 Move colocated Provider tests and update intra-Provider, cross-Provider, Bridge host, and test imports for the new depth.
- [x] 1.3 Keep AgentService and host installation as Bridge-root consumers, updating their Provider and executable-resolver imports without moving Bridge host responsibilities.
- [x] 1.4 Align current RFC and AgentService test terminology with the Agent Provider and Automation Adapter distinction.

## 2. Preserve Build and Release Behavior

- [x] 2.1 Update deterministic release artifact inventories for the nested `dist/providers/` output while preserving the Bridge package and native-host entry points.
- [x] 2.2 Clean and build the Bridge, then confirm obsolete flat Provider artifacts and stale live source references are absent.

## 3. Verify the Refactor

- [x] 3.1 Run the Bridge typecheck and complete Bridge tests, including Codex, Claude Code, ACP, Qoder, OpenCode, and host-installation coverage.
- [x] 3.2 Run release checks, a frozen pnpm install, the full repository check, OpenSpec validation, and `git diff --check`.
- [x] 3.3 Review the final diff and compatibility records; preserve current classifications and note that live Provider or browser acceptance is not required because no behavior or evidence claim changes.
