# `@panerelay/browser-use`

Use the browser-use CLI, CLI MCP, and native helpers with your existing signed-in Chrome session. Browser Harness keeps its automation semantics; Panerelay supplies an Extension-backed connection to explicitly authorized tabs without enabling Chrome Remote Debugging or exporting login state.

This is an opt-in **automation tool integration** and a peer of agent-browser. It does not replace or modify browser-use.

## Before you start

- Install the official [Panerelay Extension](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) in Chrome.
- Install Node.js 20 or newer.
- Install browser-use 0.13.7 or newer with its complete CLI runtime by following the [upstream CLI instructions](https://docs.browser-use.com/open-source/browser-use-cli).

Panerelay setup verifies browser-use but does not install, upgrade, downgrade, rewrite, or add it to `PATH`.

## Set up with your Agent

Copy this instruction into the Agent you already use:

```text
Fetch this guide with curl -fsSL and follow the browser-use scenario: https://f-loat.github.io/panerelay/agent-setup.md
```

The version-controlled [Agent setup instructions](../../docs/agent-setup.md) define the inspection, official upstream installation, Panerelay integration, user authorization stop, and acceptance report.

## Set up manually

After `browser-use --help` confirms that the CLI is available, install and diagnose the Panerelay integration. Setup probes the installed browser-use and Browser Harness package versions directly and stops if they are unsupported:

```bash
npx --yes @panerelay/setup --browser-use
npx --yes @panerelay/setup doctor --browser-use
```

Open Panerelay in Chrome and authorize the current tab or all supported web tabs. Re-run the doctor command and require the browser-use compatibility and Extension-connection checks to pass.

Then use the exact launcher and browser-use executable paths printed by setup to run the standard browser-use tab-list command. This POSIX example uses the default launcher path and a browser-use executable on `PATH`:

```bash
~/.panerelay/bin/panerelay-browser-use-cli run browser-use -- browser-use tab list
```

Success means the command lists only tabs authorized in Panerelay.

## What setup adds

Setup adds only Panerelay-owned integration files:

- a protected adapter and private Panerelay CLI;
- an additive `panerelay-browser-use` Skill without replacing the official browser-use Skill;
- a CLI MCP launcher;
- a saved Direct or Extension connection preference.

The setup output prints the exact platform-specific launchers. Agents should use those printed commands or the additive Skill instead of guessing a private path. This package supplies connection environment to the engine-neutral Panerelay CLI and is not intended to be invoked directly by Agents.

## Supported surfaces

| Surface | Support |
| --- | --- |
| Setup-managed browser-use CLI | Supported |
| Additive Panerelay browser-use Skill | Supported |
| browser-use CLI MCP through the setup launcher | Supported |
| Saved Direct or Extension mode and one-run override | Supported |
| Arbitrary browser-use Python SDK construction | Not transparently intercepted; requires explicit connection integration |

## Runtime boundary

Extension mode exposes only explicitly authorized tabs. Unsupported browser-wide, whole-profile, isolated-context, and top-level containment operations fail explicitly.

A private browser-use daemon persists across sequential commands and shares its current-page state; it is not per-Agent task isolation. Simultaneous canonical runs are serialized or fail busy. User release, authorization loss, Extension or Native Host disconnection, and WebSocket loss remove browser authority even if the detached upstream process remains alive.

## Compatibility

browser-use 0.13.7 is the supported minimum. The exact verified baseline is browser-use 0.13.7 with Browser Harness 0.1.8. Newer supported versions meet the version floor but do not automatically inherit `Verified` status.

- [Upstream browser-use CLI documentation](https://docs.browser-use.com/open-source/browser-use-cli)
- [Upstream browser-use CLI MCP documentation](https://docs.browser-use.com/open-source/customize/integrations/mcp-server)
- [Panerelay browser-use 0.13.7 compatibility record](../../docs/compatibility/browser-use-0.13.7.md)
- [`@panerelay/setup` technical reference](../setup/README.md)
