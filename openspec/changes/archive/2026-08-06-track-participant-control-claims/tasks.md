## 1. Protocol Contract

- [x] 1.1 Add and strictly validate the bounded target-control presentation update with an opaque target ID and optional automation engine
- [x] 1.2 Add protocol tests for accepted engine, cleared engine, unknown engine, and malformed envelope cases

## 2. Bridge Control Claims

- [x] 2.1 Replace lease-wide controlled-target storage with ordered participant-scoped target claims and derive observed and controlled totals
- [x] 2.2 Acquire or refresh a claim before each authorized control-class command without weakening the shared fail-closed classifier
- [x] 2.3 Remove claims on final participant target-reference cleanup, participant termination, target removal, and whole-lease revocation while preserving shared attachments
- [x] 2.4 Emit deterministic fallback or cleared presentation transitions when the latest live claim changes
- [x] 2.5 Add Bridge tests for overlapping engines, latest-claim refresh, final-reference cleanup, downgrade to observed, fallback, command failure, and full revocation

## 3. Extension Presentation

- [x] 3.1 Handle target-control transitions independently from debugger attach and detach state
- [x] 3.2 Add replace-only engine favicon fallback and restore-without-detach behavior that remains document-local across navigation
- [x] 3.3 Add Extension tests for fallback, no-marker navigation, downgrade, idempotent missing targets, and existing detach cleanup

## 4. Architecture and Compatibility Records

- [x] 4.1 Amend RFC-0003 and RFC-0004 with participant claim lifetime, aggregate downgrade, and engine fallback decisions
- [x] 4.2 Update agent-browser 0.33.0, Browser Use 0.13.7 / Browser Harness 0.1.8, and Playwright CLI 0.1.17 compatibility records with coexistence evidence and explicit Chrome versus Edge status

## 5. Verification and Cleanup

- [x] 5.1 Run package-focused protocol, Bridge, and Extension tests plus formatting, lint, typecheck, strict OpenSpec validation, and `git diff --check`
- [x] 5.2 Run the full frozen-install and repository check required by AGENTS.md
- [x] 5.3 Verify agent-browser, Browser Use, and Playwright coexistence and participant cleanup in the authorized existing Chrome profile without widening authorization
- [x] 5.4 Remove generated browser artifacts and machine-specific output, confirm expected live-process cleanup boundaries, and review the final worktree
