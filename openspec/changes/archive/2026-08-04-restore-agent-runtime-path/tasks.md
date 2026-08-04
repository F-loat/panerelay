## 1. Protected Runtime Environment

- [x] 1.1 Add bounded cross-platform absolute path normalization and environment-composition helpers.
- [x] 1.2 Persist setup-time Agent path entries in the user-protected runtime config and validate them on read.
- [x] 1.3 Pass the reconstructed environment explicitly to every built-in Agent provider and its child process.

## 2. Tests and Records

- [x] 2.1 Add Native Host installation, POSIX/Windows path, AgentService, and Qoder ACP runtime regressions.
- [x] 2.2 Amend RFC-0001 and the agent-browser compatibility record with the protected runtime environment boundary and tested evidence level.
- [x] 2.3 Run scoped Bridge/setup checks, full workspace checks, OpenSpec strict validation, and `git diff --check`.
- [x] 2.4 Reinstall the local development Native Host, reload the unpacked Extension, and verify Qoder resolves `agent-browser` without probing or installation fallback; clean up the test conversation/session.
