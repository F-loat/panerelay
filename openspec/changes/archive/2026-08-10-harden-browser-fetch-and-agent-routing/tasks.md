## 1. Reproducible Browser Evidence

- [x] 1.1 Add bounded local MV3 fixtures for redirect opacity, unpartitioned Set-Cookie write-back, no-cookie removal, and exact-origin localStorage reads.
- [x] 1.2 Record the spike conclusions and supported/unsupported boundaries without committing browser logs or credentials.

## 2. Protocol And Relay Authority

- [x] 2.1 Bump fetch-session and adapter protocols and add canonical origin-pattern and protected binding-policy validators with unit tests.
- [x] 2.2 Store origins and binding policies in Bridge fetch sessions, enforce request origin and binding IDs before Native Messaging, and cover revocation/session cleanup.
- [x] 2.3 Scope raw CLI sessions to one exact origin and adapter sessions to protected manifest authority, with client and dispatcher regression tests.

## 3. Extension Browser-State Fetch

- [x] 3.1 Remove redirect following and caller redirect modes, using fail-closed redirect errors across protocol, Extension, CLI, and tests.
- [x] 3.2 Resolve Cookie and exact-origin localStorage policies inside the Extension without navigation or value disclosure, including lifecycle and permission failures.
- [x] 3.3 Enable unpartitioned Cookie write-back while keeping explicit outgoing Cookie control and partitioned Cookies unsupported.
- [x] 3.4 Implement minimum-length, textual/JSON secret redaction and reject unsafe short or binary bound responses.

## 4. Site Adapter Migration

- [x] 4.1 Add literal origins and protected binding metadata to every built-in and fixture source adapter and update build/registry/artifact tests.
- [x] 4.2 Replace existing per-request Cookie declarations with protected binding IDs and run affected site unit tests.
- [x] 4.3 Implement and test the Flomo memo adapter using exact-origin localStorage token binding, then update the migration matrix.

## 5. Agent Fetch MCP

- [x] 5.1 Implement the bounded stdio Fetch MCP mode over Browser Registry with initialize/list/call/cancel/cleanup tests.
- [x] 5.2 Inject Fetch MCP and process-local hosted-search disable configuration into Codex app-server, preserving provider lifecycle tests.
- [x] 5.3 Inject Fetch MCP and deny built-in WebFetch in Panerelay-owned Claude turns while preserving WebSearch, settings sources, approvals, resume, interruption, and cleanup tests.

## 6. External Agent Integration

- [x] 6.1 Add explicit localized setup/install/remove lifecycle for external Codex Fetch MCP routing with conflict-safe ownership and tests.
- [x] 6.2 Add explicit localized setup/install/remove lifecycle for external Claude Code Fetch MCP routing with conflict-safe ownership and tests.
- [x] 6.3 Extend doctor and machine-readable diagnostics for MCP registration, native fetch disable state, stable launcher targets, and non-disclosure.

## 7. Durable Guidance And Compatibility

- [x] 7.1 Add the durable RFC amendment for fetch authority, storage ownership, redirects, and Agent routing, and update RFC-0001/RFC-0009 references.
- [x] 7.2 Update the repository Skill, setup/CLI documentation, Codex/Claude compatibility records, browser-fetch compatibility, and release gates.
- [x] 7.3 Classify provider and browser evidence as Verified, Forwarded, Partial, or Unsupported without changing unrelated automation baselines.

## 8. Verification And Cleanup

- [x] 8.1 Run focused protocol, Bridge, Extension, CLI, setup, provider, site-kit, and sites tests plus compiled test coverage.
- [x] 8.2 Run isolated E2E for each newly enabled or binding-migrated site and one real MCP → Bridge → reloaded daily Chrome fetch, recording only sanitized evidence.
- [x] 8.3 Run `pnpm install --frozen-lockfile`, `pnpm run check`, and `git diff --check`; remove temporary rules/processes and reconcile compatibility/task records with results.

## 9. Unified Skill name

- [x] 9.1 Rename the repository Skill and current product/spec references from `panerelay-browser` to the single-entry-point `panerelay` name without a compatibility alias, then rerun Skill, website, Bridge, release, OpenSpec, and full repository checks.
