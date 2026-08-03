## 1. Independent Skill

- [x] 1.1 Add one repository-level `panerelay-browser` Skill with shared safety/readiness instructions and agent-browser, Browser Use, and Playwright CLI workflows.
- [x] 1.2 Add Skill troubleshooting for upstream executables, Panerelay integrations, Extension authorization, and `npx skills` installation/update/removal.
- [x] 1.3 Add automated validation that `npx skills` discovers only the unified public Skill and setup package inputs contain no Skill artifacts.

## 2. Setup Boundary and Interaction

- [x] 2.1 Remove setup's Skill module, exports, package inputs, lifecycle result fields, installation/uninstallation hooks, and doctor check without removing engine program probes or Provider/adapter management.
- [x] 2.2 Replace per-engine interactive questions with one localized numbered multiselect and at most one localized default confirmation while preserving explicit flags and non-interactive behavior.
- [x] 2.3 Update setup lifecycle, doctor, CLI, localization, and packed-artifact tests for the separated boundary and prompt contract.

## 3. Guidance and Durable Decisions

- [x] 3.1 Rewrite English and Chinese root quickstarts as Extension-plus-Skill onboarding, move manual details into Advanced, and replace both hero images with the supplied asset.
- [x] 3.2 Remove `docs/agent-setup.md`, its website copy/serve plugin, all curl-based Agent handoffs, and their tests; replace website and package references with `npx skills` guidance.
- [x] 3.3 Update setup/automation package references, compatibility records, RFC-0001, and RFC-0007 to describe independent Skill lifecycle without changing capability classifications.

## 4. Verification and Cleanup

- [x] 4.1 Run setup and website targeted tests, Skill discovery/package-content checks, OpenSpec strict validation, and `git diff --check`.
- [x] 4.2 Run `pnpm install --frozen-lockfile` and the full `pnpm run check` workspace gate.
- [x] 4.3 Verify the unchanged agent-browser 0.33.0 daily-Chrome authorization boundary when a connected authorized test tab is available, or record the existing compatibility evidence and why a new live run is not applicable to this packaging-only boundary change.
- [x] 4.4 Remove obsolete generated Skill sources and confirm no `curl` Agent-guide or setup-owned Skill references remain.
