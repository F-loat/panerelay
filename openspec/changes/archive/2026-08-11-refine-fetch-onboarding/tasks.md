## 1. Extension authorization cards

- [x] 1.1 Add localized compact Automation authorization and Fetch authorization labels and render both controls in every connected welcome state.
- [x] 1.2 Add compact current-domain/all-domain behavior to the existing Fetch authorization panel using the established controller operations and fail-closed eligibility state.
- [x] 1.3 Add component coverage for independent scope changes, unavailable-Agent visibility, permission denial, and unsupported current-domain behavior.
- [x] 1.4 Render the two compact controls as independent single-row cards after the two suggestion cards and update structural tests.
- [x] 1.5 Replace the interaction-analysis suggestion with a distinct operate-page action, then remove the redundant find-information suggestion and its unused controller and localization paths.
- [x] 1.6 Remove the compact release option, make selected automation and Fetch scopes toggle off on reselection, and cover independent control behavior.

## 2. Repository onboarding

- [x] 2.1 Reorganize both root READMEs around Fetch and Connect, move MCP setup into advanced management, and replace the architecture text diagram with Mermaid.
- [x] 2.2 Document individual and all-built-in adapter installation before authorization and add a concise OpenCLI migration credit with its upstream link.
- [x] 2.3 Add setup parsing, expansion, help, and release-documentation regression coverage for `npx --yes @panerelay/setup add --all`.
- [x] 2.4 Run base Setup before bare command examples in both root READMEs and clearly distinguish the Setup-managed CLI, independent adapter lifecycle, and Agent Skill.
- [x] 2.5 Shorten the bilingual homepage hero, put Fetch before Connect, and render a complete CLI/domain/absolute-URL/adapter quickstart plus separate Setup and Skill commands.
- [x] 2.6 Add ownership-aware same-version global CLI install/update/uninstall behavior to base Setup while preserving existing installations and keeping adapter commands independent.
- [x] 2.7 Keep README and homepage onboarding linear: move manual Connect, FAQ, and contributor details behind collapsed disclosure, and place homepage Setup before workflows.

## 3. Validation and cleanup

- [x] 3.1 Run focused Extension, setup, and release-documentation tests and resolve failures.
- [x] 3.2 Validate the four-row Extension welcome card stack in a reloaded daily Chrome session without changing stored authorization unexpectedly.
- [x] 3.3 Run strict OpenSpec validation, frozen installation, the full repository check, formatting checks, and `git diff --check`.
- [x] 3.4 Add source regressions for CLI installation, command validity, workflow ordering, localized hero copy, and centered reel sizing; validate desktop and 375-pixel homepage layouts in Chrome.
