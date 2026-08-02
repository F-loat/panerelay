# `@panerelay/browser-use`

**Agent Use Browser with browser-use.** Keep using its CLI, CLI MCP, and native helpers in explicitly authorized tabs from your existing signed-in Chrome profile. Panerelay supplies the Extension-backed connection without enabling Chrome Remote Debugging or exporting login state.

This is an explicit Panerelay integration, at the same setup level as agent-browser. It does not replace or modify browser-use.

## Requirements

- Chrome with the Panerelay Extension installed
- Node.js 20+
- browser-use 0.13.7 or newer with its complete installed runtime

## Ask your Agent to set it up

```text
Set up Panerelay so my Agent can use browser-use with my existing signed-in Chrome browser. Inspect the local environment first. Install or update browser-use from its official source only if needed, then use Panerelay's official setup tool to enable the browser-use integration. Run the relevant Panerelay doctor check and verify the Extension-backed connection. Preserve browser-use's native workflow, do not change unrelated Agent settings, and ask me to authorize a tab in the Panerelay extension when required.
```

Success means the Panerelay doctor check passes the browser-use and connection checks after the user authorizes a tab in the Extension.

## Technical CLI reference

```bash
npx --yes @panerelay/setup --browser-use
npx --yes @panerelay/setup doctor --browser-use
```

Then authorize the current tab or all supported web tabs in the Extension.

Setup does not install, upgrade, downgrade, or rewrite browser-use and does not change `PATH` or the official browser-use Skill. It adds a protected adapter, private Panerelay CLI, additive `panerelay-browser-use` Skill, and CLI MCP launcher.

## Supported surfaces

- Setup-managed browser-use CLI invocations
- The additive Panerelay browser-use Skill
- browser-use CLI MCP through the launcher printed by setup
- Saved Direct or Extension mode plus a one-run override

Panerelay does not transparently intercept arbitrary browser-use Python SDK construction. SDK applications need an explicit connection integration and are outside this workflow.

## Runtime boundary

Extension mode exposes only explicitly authorized tabs. Unsupported browser-wide, whole-profile, isolated-context, and top-level containment operations fail explicitly. A private browser-use daemon persists across sequential commands and shares current-page state; it is not per-Agent task isolation. Simultaneous canonical runs are serialized or fail busy. User release, authorization loss, or connection failure removes browser authority.

## Compatibility

browser-use 0.13.7 is the supported minimum. The exact verified baseline is browser-use 0.13.7 with Browser Harness 0.1.8; newer supported versions do not automatically inherit `Verified` status.

- [Upstream browser-use CLI documentation](https://docs.browser-use.com/open-source/browser-use-cli)
- [Upstream browser-use CLI MCP documentation](https://docs.browser-use.com/open-source/customize/integrations/mcp-server)
- [Panerelay browser-use 0.13.7 compatibility record](../../docs/compatibility/browser-use-0.13.7.md)

This package supplies connection environment to the engine-neutral Panerelay CLI and is not intended to be invoked directly by Agents.
