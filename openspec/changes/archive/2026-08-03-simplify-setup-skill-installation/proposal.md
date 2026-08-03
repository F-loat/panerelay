## Why

Panerelay currently couples automation Skill files to `@panerelay/setup`, so setup installs, removes, and diagnoses Agent-facing instructions in addition to managing the Native Host and automation integrations. This makes the quickstart longer, fragments the three automation workflows across separate Skills, and prevents the standard Agent Skills toolchain from owning Skill lifecycle.

## What Changes

- **BREAKING**: stop installing, removing, exporting, packaging, or diagnosing Agent Skills from `@panerelay/setup`; existing setup-installed Skill copies are left untouched during update and uninstall because they are no longer setup-owned.
- Publish one repository-level `panerelay-browser` Skill, installable and updatable through `npx skills`, that covers agent-browser, Browser Use, and Playwright CLI setup, use, verification, and troubleshooting.
- Keep `@panerelay/setup` responsible for the Native Host and the selected agent-browser 0.33.0+, Browser Use 0.13.7+/Browser Harness 0.1.8+, and Playwright CLI 0.1.17+ program probes, Panerelay Provider/adapter artifacts, and supported default-connection settings.
- Reduce interactive setup to one integration multiselect followed by at most one confirmation for making the selected default-capable integrations the user defaults. Explicit flags remain available for automation and non-interactive use.
- Change the primary onboarding flow to two steps—install the Chrome Extension, then install the Skill—and move manual setup commands, connection details, compatibility constraints, and troubleshooting into advanced sections.
- Remove the published `curl`-fetched Agent setup guide, every prompt that asks an Agent to fetch it, and the website build/test plumbing that serves it; the installed Skill becomes the only Agent instruction source.
- Include upstream automation-tool installation and matching Skill installation/repair guidance in troubleshooting, while keeping user-controlled browser authorization explicit.
- Replace the root README hero image in both languages with the supplied shared asset.
- Amend the accepted integration RFCs where they currently assign Skill lifecycle to setup.

## Capabilities

### New Capabilities

- `panerelay-browser-skill`: Defines the independently managed, unified Agent Skill for installing, configuring, using, verifying, and troubleshooting all three supported automation engines.

### Modified Capabilities

- `guided-browser-readiness`: Changes the recommended onboarding sequence and interactive setup behavior while preserving explicit authorization and default-selection boundaries.
- `setup-cli-localization`: Replaces the sequence of per-engine prompts with one localized multiselect and one localized default confirmation.
- `stable-distribution`: Removes Skill artifacts and lifecycle from the setup package and publishes the repository-level Skill through the standard `npx skills` discovery layout.

## Impact

- Affected implementation: `packages/setup` lifecycle, doctor, CLI interaction, localization, exports, build inputs, and tests.
- Affected Skill surface: the three setup-bundled Skills are replaced by `skills/panerelay-browser` at repository scope, managed by `npx skills add`, `update`, and `remove`.
- Affected docs: English and Chinese root READMEs, setup and automation package references, removal of the Agent guide/website handoff, compatibility guidance, and RFC-0001/RFC-0007 statements about Skill ownership.
- Compatibility groups remain pinned to agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, and Playwright CLI 0.1.17. This change does not alter CDP behavior, automation semantics, browser selection, control leases, or supported browser/version evidence.
- Non-goals: silently installing third-party tools from the base setup path; making Playwright a default connection; granting site access, authorizing tabs, or treating browser focus as ownership; changing the Bridge/Extension trust boundary; patching or replacing any upstream automation engine.
