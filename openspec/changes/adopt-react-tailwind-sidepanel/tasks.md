## 1. Build and test foundation

- [x] 1.1 Add React 19, React DOM, Tailwind CSS 4, Vite integration, Vitest, Testing Library, and happy-dom to the Extension package
- [x] 1.2 Configure Vite, TypeScript, Tailwind entry styles, and component-test setup without changing the background service-worker bundle

## 2. Typed Side Panel architecture

- [x] 2.1 Extract localized messages and provider-neutral Chrome runtime calls into typed modules
- [x] 2.2 Implement a reducer-backed Side Panel controller with explicit state and cleaned-up runtime subscriptions
- [x] 2.3 Preserve provider selection, eager conversation lifecycle, authorization, activity, approvals, interruption, settings, and global error behavior in controller tests

## 3. React component migration

- [x] 3.1 Implement React components for the header, provider/conversation actions, status surfaces, welcome cards, authorization, timeline, composer, approvals, and settings
- [x] 3.2 Migrate layout and state variants to Tailwind utilities and semantic tokens while retaining scoped styles for Markdown and complex activity details
- [x] 3.3 Switch the Side Panel HTML to the React entry point and remove superseded imperative DOM wiring, select-menu code, and static structure assertions

## 4. Verification and cleanup

- [x] 4.1 Add component tests for English and Chinese rendering, provider states, authorization, suggestions, message submission, activity, approvals, errors, and settings
- [x] 4.2 Confirm RFC-0001, RFC-0002, and agent-browser 0.33.0 compatibility claims are unchanged and document any build-only compatibility note if needed
- [x] 4.3 Run Extension tests/typecheck/build, the full repository check, OpenSpec validation, and `git diff --check`
- [ ] 4.4 Reload the unpacked Extension and smoke-test the narrow and wide Side Panel, then remove temporary browser state and screenshots
