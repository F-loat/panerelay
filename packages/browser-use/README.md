# `@panerelay/browser-use`

Use the browser-use CLI, CLI MCP, and native helpers with your existing signed-in Chrome session. Browser Harness keeps its automation semantics; Panerelay supplies an Extension-backed connection to explicitly authorized tabs without enabling Chrome Remote Debugging or exporting login state.

This is an opt-in **automation tool integration** and a peer of agent-browser. It does not replace or modify browser-use.

## Before you start

- Install the official [Panerelay Extension](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) in Chrome.
- Install Node.js 20 or newer.
- Install browser-use 0.13.7 or newer with Browser Harness 0.1.8 or newer by following the [upstream CLI instructions](https://docs.browser-use.com/open-source/browser-use-cli).

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

Then use the official Browser Use CLI with the fixed Panerelay discovery URL. This works even when Extension mode is not saved as the default:

```bash
BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use browser-use <<'PY'
print(list_tabs())
PY
```

PowerShell:

```powershell
$env:BU_CDP_URL = 'http://127.0.0.1:43827/cdp/browser-use'
@'
print(list_tabs())
'@ | browser-use
```

Command Prompt:

```bat
set "BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use"
echo print(list_tabs()) | browser-use
```

Success means the command lists only tabs authorized in Panerelay.

### Browser Harness environment

In Extension mode, setup manages Browser Harness's user-scoped environment file and writes the fixed discovery URL below:

```dotenv
BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use
```

You normally do not need to set this variable yourself. `browser-use` and `browser-use --cli-mcp` read it directly. The URL is a stable loopback discovery endpoint, not a permanent CDP credential: Panerelay selects the configured browser and creates a short-lived connection behind it for each Browser Harness daemon. Do not copy or persist the dynamic WebSocket/bootstrap URL returned during discovery.

The explicit `BU_CDP_URL=` prefix is a one-process override. After saving Extension mode, it can be omitted. Do not set Browser Harness's higher-priority `BU_CDP_WS` at the same time; it takes precedence over `BU_CDP_URL`.

Use the base CLI to change the durable mode:

```bash
panerelay connection use browser-use extension  # manage BU_CDP_URL
panerelay connection use browser-use direct     # remove Panerelay-managed Browser Harness keys
```

The managed environment file is the default for new Browser Use processes. An explicitly supplied process environment still takes precedence for that process.

## What setup adds

Setup adds only Panerelay-owned integration files:

- a protected Browser Use adapter registration and internal adapter launcher (it does not replace the official `browser-use` command);
- an additive `panerelay-browser-use` Skill without replacing the official browser-use Skill;
- a saved Direct or Extension connection preference and managed Browser Harness environment file.

The official `browser-use` executable remains the user-installed command. This package supplies its connection environment and is not intended to be invoked directly by Agents.

## Supported surfaces

| Surface | Support |
| --- | --- |
| Official browser-use CLI with setup-managed environment | Supported |
| Additive Panerelay browser-use Skill | Supported |
| Official `browser-use --cli-mcp` | Supported |
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
