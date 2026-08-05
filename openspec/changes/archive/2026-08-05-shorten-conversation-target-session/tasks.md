## 1. Compact target session codec

- [x] 1.1 Replace the overlong v1 UUID text format with the canonical 56-character `panerelay-v2-` base64url encoding and exact reversible parser.
- [x] 1.2 Add protocol tests for exact output, 64-character compatibility, round trips, UUID validation, canonical encoding, malformed values, and legacy v1 rejection.

## 2. Provider and guidance integration

- [x] 2.1 Update the agent-browser Provider to bind valid v2 sessions, reject malformed current and legacy target prefixes before browser fallback, and preserve ordinary short sessions.
- [x] 2.2 Update Bridge context, target-scoped Playwright gateway, and provider prompt tests to assert the compact shared session value.

## 3. Durable documentation

- [x] 3.1 Amend RFC-0002 and RFC-0007 with the compact encoding, upstream limit, legacy rejection, and unchanged authorization and ownership boundaries.
- [x] 3.2 Update agent-browser and Playwright package guidance plus pinned compatibility matrices without promoting pending `Automated` claims to `Verified`.

## 4. Verification

- [x] 4.1 Run protocol, agent-browser, Bridge, Playwright, and setup typechecks/tests that cover the changed session path.
- [x] 4.2 In the explicitly authorized daily Chrome profile, verify agent-browser 0.33.0 accepts an injected v2 session, exposes the intended target as `t1`, rejects the legacy v1 value without fallback, and release the exact test session without changing page state.
- [x] 4.3 Run `pnpm install --frozen-lockfile`, the full workspace check, strict OpenSpec validation, and `git diff --check`.
