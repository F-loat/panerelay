## Why

The top-level `panerelay` help currently gives low-level connection wrappers and recovery commands the same prominence as Fetch, site adapters, and setup, even though the supported agent-browser, Browser Use, and Playwright workflows do not use those wrappers. With no legacy-user compatibility requirement, the public command surface should match the actual setup-first product path instead of retaining unused entry points.

## What Changes

- **BREAKING** Remove the public `panerelay browser clear`, `panerelay connection resolve`, and `panerelay run` commands.
- Remove the child-process wrapper and concurrency-lock implementation used only by `panerelay run`.
- Keep browser-default clearing as an internal capability for the Extension settings surface, and keep `panerelay browser use` for selecting or replacing a CLI default.
- Keep `panerelay connection use` for explicitly switching an installed Browser Use integration between Direct and Extension modes.
- Refocus top-level help on site commands, browser-authenticated Fetch, connected-browser selection, base Setup, and `setup add` adapter management; remove the temporary `npx @panerelay/cli` example.
- Update the accepted Browser Use RFC, main specifications, and package documentation so they describe the direct upstream-engine workflows rather than a Panerelay child-process wrapper.

Non-goals: this change does not alter site or tab authorization, control leases, browser ownership, Fetch behavior, the Browser Use gateway, Playwright attach behavior, or agent-browser automation semantics. Panerelay still cannot launch, close, or otherwise own the user's browser process.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `panerelay-cli`: Narrow the public CLI to commands used by supported product workflows and make its help setup-first.
- `cli-meta-options`: Remove the `panerelay run` child-argument metadata exception together with the removed wrapper command.
- `multi-browser-routing`: Keep browser listing and default selection on the Setup-provided global CLI while moving default clearing to Extension settings.
- `panerelay-skill`: Use the Setup-provided global `panerelay` command for recurring browser and connection administration instead of temporary CLI package execution.

## Impact

- `packages/cli`: parser, dispatch, localized help, exports, wrapper/lock code, and tests.
- `packages/setup`, `skills/panerelay`, and package documentation: examples and wording that mention removed commands or temporary CLI execution.
- `openspec/specs/panerelay-cli`, `openspec/specs/cli-meta-options`, `openspec/specs/multi-browser-routing`, `openspec/specs/panerelay-skill`, and RFC-0007.
- Browser Use 0.13.7 with Browser Harness 0.1.8 remains the affected connection compatibility group; Playwright CLI 0.1.17 documentation remains aligned with explicit attach. The pinned agent-browser 0.33.0 Provider path is unaffected.
