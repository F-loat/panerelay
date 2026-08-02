## Context

See [proposal.md](proposal.md) for motivation. Today the setup lifecycle always discovers agent-browser, writes both the Native Host's private agent-browser configuration and the user-level Panerelay Provider registration, installs the agent-browser Skill, and includes both agent-browser checks in ordinary doctor output. Codex, Claude Code, and Qoder consume the private configuration to inject a scoped `panerelay_browser` MCP server into side-panel conversations. Browser Use already uses an explicit option. The accepted RFC-0001 design currently mandates that injection and must be amended with the implementation.

RFC-0001 defines the agent-browser Provider boundary and setup ownership; RFC-0005 defines shared Chrome and Edge Native Messaging installation. The change amends only integration selection and readiness presentation. The Verified agent-browser 0.33.0 and Browser Use 0.13.7 baselines, Forwarded Edge classifications, and Unsupported browser-process ownership groups remain unchanged.

## Goals / Non-Goals

**Goals:**

- Make base setup install only the Native Host and engine-neutral side-panel prerequisites.
- Model agent-browser and Browser Use as independent, combinable explicit selections.
- Scope dependency checks, Agent-owned Provider/Skill configuration, installation output, doctor results, and Extension default controls to explicitly selected integrations.
- Let users install a missing integration from Extension settings without exposing a general-purpose command runner.
- Remove engine-specific MCP injection, instructions, session labels, and cleanup from all side-panel Agent providers.
- Keep setup, update, doctor, help, docs, and tests bilingual and internally consistent.

**Non-Goals:**

- Preserve or migrate artifacts from pre-release setup behavior.
- Install or update upstream automation engines.
- Change Provider/adapter protocols, browser routing, authorization, control ownership, or engine semantics.
- Upgrade any compatibility classification or version baseline.

## Decisions

### Add one explicit `agentBrowser` setup selection

Argument parsing will add `--agent-browser` alongside the existing `--browser-use` flag. Both flags are independent booleans, so their four combinations map directly to base-only, agent-browser-only, Browser-Use-only, and both-integrations setup.

The alternative of treating `--global-provider` or `--project-provider` as an implicit installation request is rejected because it preserves hidden agent-browser selection. Those scope options require `--agent-browser` and fail before filesystem changes when used alone.

### Keep automation engines out of Native Host runtime configuration

Native Host installation continues discovering Codex, Claude Code, and Qoder because those are side-panel Agent providers. It no longer discovers agent-browser or stores any automation-engine executable, version, or private Provider configuration. The setup layer performs the agent-browser compatibility probe only when selected, then writes the user-facing Provider and Skill configuration. Browser Use retains its existing explicit setup-owned adapter gate.

The alternative of keeping private agent-browser discovery for side-panel convenience is rejected because that would preserve a hidden default adapter.

### Let side-panel Agents own browser-tool configuration

Codex thread creation, Claude queries, and Qoder ACP session creation will stop adding `panerelay_browser`, engine-specific instructions, or engine session identifiers. They retain the selected canonical project as the actual Agent working directory, plus only bounded current-tab URL/title orientation, the approval bridge where applicable, and the current-browser environment. The project path is not duplicated into prompt metadata. User-configured MCP servers and Skills are loaded by each Agent through its own supported configuration rules.

Panerelay does not infer that a tool process belongs to a conversation and does not issue engine-specific close commands at turn boundaries. Relay participants retain the existing authenticated liveness and explicit user-release cleanup. The alternative of replacing agent-browser injection with Browser Use injection or an automatic installed-engine choice is rejected because it would recreate the same hidden ownership and introduce ambiguous lifecycle semantics.

### Make doctor selection explicit

Plain doctor validates the Native Host and common side-panel providers. `doctor --agent-browser` and `doctor --browser-use` add their respective integration checks and may be combined. This makes a clean base installation healthy without either engine while retaining actionable version checks for selected integrations.

### Turn the missing-Host state into a composable setup guide

When Chrome cannot find the Native Host, the side panel explains that Panerelay connects the user's existing browser session to local Agents through an explicitly authorized relay. The title and primary description follow the connected welcome state's heading placement directly below the welcome icon and remain outside the card stack. The guide then uses the connected welcome state's content width, ordinary border, surface background, radius, vertical rhythm, and readable title/body scale rather than the smaller timeline microcopy scale. It renders supporting benefits, the setup action, and optional automation tools in that order as three sibling cards with no enclosing panel, avoiding one oversized visual block and keeping the optional integrations below the required local installation step. The setup-action card uses an action-oriented installation title with the same heading treatment as the optional-tools card instead of repeating a missing-Host diagnostic. The base command remains selected by default with no automation adapter. The guide presents `agent-browser` and `browser-use` as compact text-only toggles that reuse the settings controls' ordinary and selected treatments, without descriptions, checkbox glyphs, or status indicators. Both selections remain independent, append their fixed flags in a deterministic order, and may be combined in one idempotent setup invocation. It does not imply that setup installs either upstream engine.

The generated command stays visible as text on the theme's conventional muted-gray raised surface and has an adjacent compact icon-only copy button with a localized accessible name and short copied confirmation. Selection and copying are purely local presentation state; only the existing retry action contacts the Native Host. The integration selection is owned by the side-panel application above the transient missing-Host view, so retrying the connection or temporarily hiding and restoring that view does not reset the generated command. The alternative of selecting an adapter by default is rejected because it would reintroduce the hidden preference removed by this change.

### Derive Extension availability from setup-managed registrations

The Bridge already owns protected local integration state. The agent-browser default-setting operation will report unavailable when the Panerelay Provider registration is absent, matching the existing Browser Use adapter gate. The Extension keeps both buttons visible as `agent-browser` and `browser-use`. An unavailable integration remains clickable while the Native Host is connected, uses ordinary pointer behavior, and changes its hover copy to a localized `Click to install` / `点击安装` action. Hover does not change the button background, border, or text color; selected styling remains the only accent treatment.

Clicking an unavailable integration sends one bounded install request containing only the adapter identifier. The Native Host maps that closed enum to the matching setup package flag and invokes the lockstep `@panerelay/setup` version through a resolved package runner. It accepts no executable, package name, shell fragment, path, or arbitrary argument from the Extension. One install per adapter may run at a time, captured output is bounded and not returned to the Extension, and the operation has an explicit timeout.

After setup succeeds, the Bridge rechecks the setup-managed registration and selects the newly installed integration as the user-level default because the action originated in the `Set as default` row. The Extension renders an installing state until the correlated operation completes, then refreshes both availability and selected state. A failure leaves authorization and control unchanged and returns concise localized guidance with the exact manual setup command. Installation or default selection never authorizes a tab, creates an automation participant, or changes the other engine.

### Treat this as a pre-release contract replacement

No migration or cleanup pass is added for earlier development installations. Fresh setup behavior, deterministic tests, and uninstall coverage define the new contract. The release notes and RFC amendment will identify the breaking CLI change before a stable release.

## Risks / Trade-offs

- [Users may run base setup and expect browser automation immediately] → Completion output and quickstarts show separate, equally weighted engine commands.
- [A side-panel Agent has no browser tools until the user configures one] → Keep conversation readiness honest and document the two explicit adapter setup paths without injecting either engine.
- [A settings click launches package installation from a browser surface] → Expose only a closed adapter enum, pin the setup package to the connected lockstep Extension version, resolve the package runner locally without a shell, bound time and output, and never accept Extension-supplied command material.
- [Installation can take longer than ordinary settings reads] → Use a dedicated correlated request timeout and show a per-adapter installing state that prevents duplicate clicks.
- [Conditional setup paths increase test combinations] → Cover all four flag combinations plus invalid default-scope combinations and selected doctor modes.
- [Documentation can drift back toward a default engine] → Add English/Chinese and website assertions that name both explicit commands and reject the old default label.

## Migration Plan

There is no compatibility migration for earlier development installations. Ship the setup CLI, package docs, website, RFC amendment, and release assertions in the same lockstep candidate. Rollback restores the prior package set and its prior setup contract.
