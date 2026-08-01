## 1. Compatibility Gate

- [x] 1.1 Add a stable semantic-version minimum predicate for Browser Use 0.13.7 and its internal runtime 0.1.8.
- [x] 1.2 Cover exact, newer, older, malformed, prerelease, missing, and incomplete-installation cases with adapter tests.

## 2. Setup and Diagnostics

- [x] 2.1 Reuse the shared compatibility predicate in setup lifecycle and generated integration state.
- [x] 2.2 Collapse adapter and setup doctor output into one Browser Use check with Browser Use-only remediation.
- [x] 2.3 Update CLI, i18n, and setup tests so user-visible output does not present Browser Harness as a separate prerequisite.

## 3. User Guidance and Durable Records

- [x] 3.1 Update the generated Panerelay Browser Use Skill and public READMEs to require Browser Use 0.13.7 or newer without separate Browser Harness management.
- [x] 3.2 Update RFC-0007 and the exact compatibility record to distinguish minimum eligibility from the verified 0.13.7/0.1.8 evidence pair while retaining the agent-browser 0.33.0 regression baseline.

## 4. Verification

- [x] 4.1 Run focused browser-use and setup tests, the full workspace check, OpenSpec validation, and `git diff --check`.
- [x] 4.2 Confirm the existing daily-Chrome Browser Use compatibility evidence and real browser ownership boundaries remain applicable because no CDP, Bridge, Extension, Native Host, authorization, target, or cleanup path changed.
