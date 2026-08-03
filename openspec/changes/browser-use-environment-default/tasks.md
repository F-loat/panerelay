## 1. Specification and gateway foundation

- [x] 1.1 Update RFC-0007 and the main Browser Use connection spec to replace wrapper-injected ticket URLs with the fixed gateway/environment model.
- [x] 1.2 Define protected gateway state, managed Browser Harness environment keys, endpoint paths, bounded errors, and stale-owner recovery contracts.
- [x] 1.3 Implement the user-scoped gateway lifecycle, fixed loopback listener, atomic owner lock, and health/recovery handling.

## 2. Fixed CDP discovery and routing

- [x] 2.1 Implement fixed `/cdp/browser-use/json/version` discovery using shared browser-default selection and live registry validation.
- [x] 2.2 Route discovery through the selected Browser Relay's existing authenticated bootstrap and return participant WebSocket metadata without leaking bearer or ticket URLs.
- [ ] 2.3 Add gateway tests for unavailable browsers, ambiguous defaults, generation changes, lane busy, invalid methods/paths/queries, loopback binding, bounded errors, and participant revocation.
- [ ] 2.4 Add multi-browser and Native Host restart tests proving the endpoint remains stable while the selected Relay changes.

## 3. Browser Use environment ownership

- [x] 3.1 Implement atomic merge/remove of Panerelay-managed Browser Harness environment keys while preserving unrelated user configuration.
- [x] 3.2 Move Browser Use Extension/Direct mode writes from wrapper-only CLI execution into the shared integration configuration boundary.
- [x] 3.3 Ensure setup, doctor, Extension settings, uninstall, and failed-install rollback manage the gateway and environment state consistently.
- [x] 3.4 Remove the dedicated Browser Use launcher, wrapper-specific private CLI artifacts, and wrapper-only MCP launch path.

## 4. Official Browser Use integration

- [x] 4.1 Update the additive Skill and all README/website/setup examples to invoke official `browser-use` and `browser-use --cli-mcp` directly.
- [x] 4.2 Verify Browser Harness 0.1.8 loads the managed environment default and preserves explicit process environment precedence.
- [ ] 4.3 Run real daily-Chrome verification for official CLI helpers, CLI MCP, sequential reuse, concurrent startup, browser-default switching, authorization revocation, stale daemon recovery, and cleanup.
- [ ] 4.4 Update `docs/compatibility/browser-use-0.13.7.md` with Verified/Forwarded/Partial/Unsupported results and record reproducible spike evidence.

## 5. Regression and release validation

- [x] 5.1 Update setup, Bridge, CLI, Extension integration, Browser Use, website, and release-documentation tests for the new default behavior.
- [ ] 5.2 Run `pnpm install --frozen-lockfile`, `pnpm run check`, `git diff --check`, packed-consumer CI, and Windows gateway/environment lifecycle tests.
- [x] 5.3 Validate OpenSpec, review the final diff for stale wrapper commands, and confirm no credentials, page content, or generated runtime artifacts are committed.
