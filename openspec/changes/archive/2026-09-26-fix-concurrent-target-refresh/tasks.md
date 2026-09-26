## 1. Bridge reconciliation

- [x] 1.1 Preserve targets introduced during an in-flight list request and prevent stale list data from restoring explicitly destroyed targets.
- [x] 1.2 Return the reconciled target inventory to callers while preserving later removal and revocation behavior.

## 2. Verification and compatibility

- [x] 2.1 Add deterministic tests for concurrent participant creation, usable page sessions, later list removal, and explicit destruction during a pending list.
- [x] 2.2 Run package and workspace checks, OpenSpec validation, and `git diff --check`.
- [x] 2.3 Attempt a real existing-browser concurrent-session verification with a local fixture if an authorized daily-browser setup is available; record its outcome and cleanup.
- [x] 2.4 Update the agent-browser compatibility record with the regression coverage, live-verification status, and version limits.
