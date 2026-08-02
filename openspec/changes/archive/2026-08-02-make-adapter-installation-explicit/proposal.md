## Why

Panerelay setup currently treats agent-browser as the default automation integration while Browser Use is opt-in, even though both engines are peer integrations outside the Native Host and side-panel foundation. The default command should establish only the local Extension connection so users can choose either automation engine explicitly.

## What Changes

- **BREAKING**: `npx --yes @panerelay/setup` installs only the user-scoped Native Messaging Host and engine-neutral side-panel runtime prerequisites; it no longer probes agent-browser, writes its private runtime configuration, installs its Panerelay Provider or Skill, or injects browser MCP tools into side-panel Agents.
- Add `npx --yes @panerelay/setup --agent-browser` as the explicit agent-browser dependency check, Provider, and Skill installation path, parallel to `--browser-use`.
- Stop injecting agent-browser or Browser Use MCP/Skill configuration into Codex, Claude Code, or Qoder side-panel sessions. Those runtimes use their own Agent configuration; Panerelay setup changes it only through an explicitly selected adapter installation.
- Allow both adapter flags in one invocation and keep their diagnostics scoped to the integrations the user selected.
- Update setup output, doctor guidance, Extension readiness guidance, installed Skill guidance, and durable RFC/release records so neither automation engine is described as the default adapter.
- Let a connected Extension install either missing integration from the default-setting row through one fixed, setup-backed Native Host operation; keep the buttons clickable, show `agent-browser` and `browser-use` symmetrically, keep button surfaces unchanged on hover while swapping missing-integration copy, and distinguish installing and selected states.
- Expand the missing-Native-Host state into a bilingual installation guide that explains the local relay, lets users independently include `agent-browser`, `browser-use`, both, or neither in the setup command, and provides an accessible compact copy action with confirmation. Place the title and primary description beside the welcome icon using the connected-state heading pattern, then present supporting benefits, setup action, and optional tools in that order as separate lightweight cards instead of one enclosing panel. Render the command on a conventional muted code surface, render the tools as the same description-free text toggles used in settings, title the action card as an installation step instead of an error state, use connected-state reading sizes instead of microcopy sizing, and retain the user's selections across connection retries.
- Keep the pinned agent-browser 0.33.0 and Browser Use 0.13.7 compatibility baselines for their explicitly selected integrations.
- Do not add migration behavior for earlier development installs; the project is still pre-release and the new invocation contract is the only supported setup model.
- Do not install agent-browser or Browser Use themselves, change browser ownership, widen authorization, or move automation semantics into Panerelay.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `stable-distribution`: Make the Native Host the only default setup component and require explicit agent-browser installation.
- `guided-browser-readiness`: Present engine-specific readiness and setup guidance without implying agent-browser is installed by the base setup.
- `panerelay-cli`: Define both automation integrations as explicit setup-managed additions while keeping the recurring CLI engine-neutral.
- `qoder-agent-provider`: Remove Panerelay-owned agent-browser MCP injection and session cleanup from Qoder conversations in favor of Qoder's own configured tools.
- `sidepanel-agent-context`: Keep the selected project as the Agent working directory while limiting automatic browser context to bounded URL/title metadata and no tool instructions or control state.

## Impact

The change affects `@panerelay/setup` argument parsing, lifecycle orchestration, doctor checks, localized output, Provider/Skill installation, Codex/Claude/Qoder launch configuration, the bounded Native Host integration-install request, setup tests, Extension guidance, release assertions, and the accepted setup decisions in RFC-0001. It does not include the separate README and project-website rollout, and it does not change the Bridge trust boundary, browser authorization, control leases, automation command semantics, or the pinned compatibility classifications for agent-browser 0.33.0 and Browser Use 0.13.7.
