## Context

See [proposal.md](proposal.md) for motivation. Today `packages/setup` embeds three Skill directories into the npm tarball, copies them into Agent-specific global/project locations, exposes Skill helpers as a public API, removes those files during uninstall, and adds a doctor check for one of them. The CLI separately asks up to five yes/no questions for integrations and defaults. Root documentation and the published Agent guide then route users through manual setup before normal use.

The accepted transport and ownership decisions remain in RFC-0001, RFC-0002, and RFC-0007. This change only moves instruction lifecycle out of setup; it does not move Provider/adapter lifecycle or alter the Bridge, CDP lanes, authorization, revocation, or target behavior. Existing compatibility classifications remain agent-browser 0.33.0 `Verified` on its recorded Chrome baseline, Browser Use 0.13.7/Browser Harness 0.1.8 at the classifications in its matrix, and Playwright CLI 0.1.17 at the Chrome/Edge classifications in its matrix.

## Goals / Non-Goals

**Goals:**

- Make the repository the source for one standard Agent Skill and let `npx skills` own its installation targets, scope, updates, and removal.
- Keep setup focused on the Native Host, upstream program readiness, Panerelay Provider/adapter artifacts, and user defaults.
- Make an interactive setup selection bounded and predictable: one multi-value response and one optional default confirmation.
- Let the Skill carry the full path from environment inspection through setup, user authorization, engine-specific verification, and troubleshooting.

**Non-Goals:**

- Introduce a new prompt dependency or a full-screen terminal UI.
- Automatically install optional upstream engines in the base setup command.
- Remove legacy Skill copies from user machines; their ownership cannot be distinguished safely after this release.
- Change the Extension's explicit authorization UI, control leases, CDP compatibility, or automation-engine semantics.

## Decisions

### 1. Move to one repository-level Skill

The canonical source will be `skills/panerelay-browser/SKILL.md`, a standard discovery location supported by `npx skills`. It will combine the existing agent-browser command rules, Browser Use environment/daemon rules, and Playwright explicit-attach rules with a shared inspection, setup, authorization, verification, and troubleshooting workflow.

The documented command will be `npx skills add F-loat/panerelay --skill panerelay-browser`. Agent and scope selection remain owned by `npx skills`; Panerelay will not duplicate its target directory knowledge.

Alternative considered: keep three repository-level Skills. Rejected because users would still need to select the correct package before the Agent can diagnose their preferred engine, and shared readiness/security instructions would continue to drift.

### 2. Remove the setup Skill module instead of retaining compatibility wrappers

`skill.ts`, Skill exports, dependency injection hooks, result paths, build copying, package file declarations, doctor checks, and setup/uninstall calls will be removed. Setup will not migrate or delete existing copies under `.agents`, `.codex`, or other Agent directories. Documentation will direct users to `npx skills remove` if they want those managed independently.

Alternative considered: leave deprecated no-op exports. Rejected because the public API is not an accepted cross-package protocol, and keeping the module would preserve the misleading ownership boundary and bundled files.

### 3. Keep all engine integration management in setup

The `--agent-browser`, `--browser-use`, and `--playwright` flags continue to probe the selected upstream executables and install only Panerelay-owned Provider/adapter configuration. Browser Use environment management and the default-capable agent-browser/Browser Use settings remain unchanged. Playwright remains explicit and cannot become a default.

The Skill may guide an Agent through official upstream installation when a selected engine is missing, but it must inspect first and limit that work to the user's requested engine. This preserves the existing rule that base setup itself does not silently modify third-party software.

### 4. Implement multiselect as one numbered line response

To avoid adding a runtime dependency, the localized CLI will display three numbered integrations and accept a comma-separated selection in one readline prompt. Empty input selects none; invalid, duplicate, or unsupported tokens are rejected and the same prompt is repeated without advancing to additional questions. Tests can inject this prompt as a string-returning function.

If agent-browser and/or Browser Use is selected, one yes/no confirmation applies `globalDefault` to every selected default-capable integration. If only Playwright or no integration is selected, setup skips the confirmation. Any explicit integration flag, `--global-default`, or non-interactive `--yes` path bypasses interactive selection so scripts remain deterministic.

Alternative considered: arrow-key checkbox UI through a prompt library. Rejected for this change because it adds package and terminal-mode complexity without changing the one-selection contract.

### 5. Make docs two-tiered

The root README quickstart and website setup handoff will lead with only the Store Extension and `npx skills add` command. The Skill prompt tells the Agent to complete local integration and stop for authorization. Manual setup, exact engine commands, defaults, compatibility constraints, and troubleshooting move under an advanced heading. Package READMEs remain technical references and are updated to remove setup-owned Skill claims.

README hero images in both languages will use the same user-supplied asset URL. `docs/agent-setup.md`, its website build copy/plugin, the public `agent-setup.md` URL, and every `curl -fsSL` handoff will be removed instead of retained as a second instruction source. The unified installed Skill is authoritative for Agent-directed setup.

### 6. Amend durable documentation without changing compatibility claims

RFC-0001 and RFC-0007 will be amended where they state that setup installs or removes Skills. Compatibility documents will mention independent Skill management only where installation steps currently assign it to setup. No RFC status or engine capability classification changes.

## Risks / Trade-offs

- [Users retain stale setup-installed Skill copies] → Setup does not delete files it no longer owns; troubleshooting identifies duplicates and directs explicit `npx skills remove` followed by `add`.
- [`npx skills` changes its target discovery behavior] → Pin the repository layout to its documented standard `skills/<name>/SKILL.md` contract and validate discovery during release checks.
- [One Skill becomes long] → Route first by requested engine, keep shared safety/readiness steps once, and put rare errors in a troubleshooting section.
- [Comma-separated selection is less discoverable than checkbox navigation] → Print numbered choices, accepted input examples, selected summary, and localized validation errors while keeping zero new runtime dependencies.
- [Primary docs hide manual controls] → Keep an explicit Advanced link immediately after the two-step path and retain complete package/compatibility references.

## Migration Plan

1. Add and validate the unified repository-level Skill before removing setup-bundled sources.
2. Remove setup Skill code, package inputs, checks, lifecycle fields, and tests; retain engine probes and integration installers.
3. Replace interactive prompt sequencing and update localized output/tests.
4. Update root/website/package documentation, remove the published curl-fetched guide and its build plumbing, and amend RFC statements in the same change.
5. Add release assertions for `npx skills` discovery and absence of Skill files in the setup tarball.

Rollback restores the setup Skill module and bundled directories together with the previous documentation. Existing user-installed Skills remain recoverable because neither forward migration nor rollback deletes independently managed files.

## Verification Note

This change does not modify agent-browser attachment, routing, permissions, authorization, control leases, or browser target behavior, so a new daily-Chrome live acceptance run would not exercise the changed Skill packaging and setup ownership boundary. The existing agent-browser 0.33.0 authorization evidence remains recorded in `docs/compatibility/agent-browser-0.33.0.md`; this change instead validates repository Skill discovery, setup package contents, doctor output, interactive setup, and documentation routing.
