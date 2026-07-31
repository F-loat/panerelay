## 1. Architecture and registry

- [x] 1.1 Add RFC-0006 for independent registrations, deterministic selection, browser-pinned sessions, and browser-local ownership
- [x] 1.2 Add `@panerelay/browser-registry` with protected atomic registration/default storage, opaque-ID-safe paths, liveness validation, legacy fallback, and deterministic selector resolution
- [x] 1.3 Add registry tests for concurrent Chrome/Edge entries, owner cleanup, stale and invalid entries, explicit/default/single-ready precedence, unavailable defaults, and ambiguous families

## 2. Bridge and Provider routing

- [x] 2.1 Update each Native Host to write and remove only its browser registration and expose its current registration to local integration services
- [x] 2.2 Update the agent-browser 0.33.0 Provider adapter to resolve one registration per launch and release through the exact original browser entry
- [x] 2.3 Scope Codex, Claude Code, and Qoder side-panel browser MCP processes to the Native Host's browser registration
- [x] 2.4 Add Bridge and Provider tests for capability gates, side-panel selector propagation, default changes, disconnects, and exact-browser cleanup

## 3. User selection surfaces

- [x] 3.1 Add browser-default Native Messaging operations that can inspect, set the current browser, and conditionally clear the current browser
- [x] 3.2 Add a localized Extension setting that shows and changes whether the current browser is the agent-browser default without changing permissions
- [x] 3.3 Add localized `panerelay browsers`, `panerelay browser use <selector>`, and `panerelay browser clear` commands with parser and behavior tests

## 4. Compatibility and verification

- [x] 4.1 Update README, package guidance, installed Agent Skill, compatibility matrix, and RFC references for multi-browser selection and Edge's `Forwarded` status
- [x] 4.2 Run focused package tests, OpenSpec strict validation, frozen install, full `pnpm run check`, and `git diff --check`
- [x] 4.3 Verify the built Provider against the user's existing Chrome session and confirm two synthetic live registrations fail closed or route deterministically as specified
- [x] 4.4 Remove machine-specific runtime files and verification output, then sync and archive the completed OpenSpec change
