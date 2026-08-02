# @panerelay/setup

Local setup and diagnostics for Panerelay.

## Install Panerelay

Install the official [Panerelay Extension from the Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) in Chrome or Microsoft Edge, then install the Panerelay local integration. Edge may first ask you to allow extensions from other stores.

```bash
npx --yes @panerelay/setup
```

This engine-neutral command installs the Native Host and side-panel prerequisites. It does not probe an automation engine, register an agent-browser Provider, or install an automation Skill. Side-panel Agents keep the selected project as their working directory and receive bounded current-tab URL/title context; they load browser MCPs and Skills from their own Agent configuration.

All paths require explicit tab authorization in the Extension. Setup, Provider defaults, browser-use mode, and browser selection never grant access to a tab.

## Ask your Agent to configure automation

Use the natural-language handoff that matches your workflow. The Agent should inspect the environment before changing it and install an upstream tool only when needed.

**agent-browser**

```text
Set up Panerelay so my Agent can use agent-browser with my existing Chrome or Edge browser. Inspect the local environment first. Install or update agent-browser from its official source only if needed, then use Panerelay's official setup tool to enable the agent-browser integration. Run the relevant Panerelay doctor check and verify that agent-browser can list only the tabs I authorize. Do not change unrelated Agent settings, and ask me to authorize a tab in the Panerelay extension when required.
```

**browser-use**

```text
Set up Panerelay so my Agent can use browser-use with my existing signed-in Chrome browser. Inspect the local environment first. Install or update browser-use from its official source only if needed, then use Panerelay's official setup tool to enable the browser-use integration. Run the relevant Panerelay doctor check and verify the Extension-backed connection. Preserve browser-use's native workflow, do not change unrelated Agent settings, and ask me to authorize a tab in the Panerelay extension when required.
```

**Both**

```text
Set up Panerelay for both agent-browser and browser-use with my existing browser. Inspect the local environment first. Install or update each tool from its official source only if needed, then use Panerelay's official setup tool to enable both integrations together. Run the relevant doctor checks and verify each connection. Do not change unrelated Agent settings, and ask me to authorize a tab in the Panerelay extension when required.
```

## Technical CLI reference

Panerelay components are published in lockstep. Use the same version as the Panerelay Extension:

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
npx --yes @panerelay/setup uninstall --yes
```

### Explicit agent-browser integration

```bash
npx --yes @panerelay/setup --agent-browser
npx --yes @panerelay/setup doctor --agent-browser
```

Setup verifies a compatible agent-browser executable before registering the Panerelay Provider and additive Skill. It does not install or update agent-browser itself. See the [agent-browser integration guide](../agent-browser/README.md) and [compatibility record](../../docs/compatibility/agent-browser-0.33.0.md).

### Explicit browser-use integration

browser-use `0.13.7` or newer can use the existing Chrome session through an opt-in Extension-backed lane:

```bash
npx --yes @panerelay/setup --browser-use
npx --yes @panerelay/setup doctor --browser-use
```

Setup does not install, upgrade, downgrade, or rewrite browser-use. It verifies the installed versions, installs a private Panerelay CLI and adapter under `~/.panerelay`, records the exact compatible executable, and installs an additive `panerelay-browser-use` Skill without replacing the official browser-use Skill or changing `PATH`. Setup initially saves Extension mode. The setup output also prints an optional CLI MCP launcher. If the browser-use environment is incomplete, setup asks the user to repair or upgrade browser-use as one installation.

The supported surfaces are the setup-managed browser-use CLI, additive Skill, and CLI MCP launcher. Panerelay does not transparently intercept arbitrary browser-use Python SDK construction. The exact verified baseline is browser-use 0.13.7 with Browser Harness 0.1.8; newer supported versions meet the minimum without automatically inheriting `Verified` status. See the [compatibility record](../../docs/compatibility/browser-use-0.13.7.md).

The private CLI supports a durable Panerelay-owned mode and a one-run override:

```bash
~/.panerelay/bin/panerelay-browser-use-cli connection use browser-use extension
~/.panerelay/bin/panerelay-browser-use-cli connection use browser-use direct
~/.panerelay/bin/panerelay-browser-use-cli run browser-use --mode extension -- /absolute/path/to/browser-use
~/.panerelay/bin/panerelay-browser-use-cli run browser-use --mode direct -- /absolute/path/to/browser-use
```

These paths are POSIX examples; use the exact launchers printed by setup on the current platform. One-run overrides do not change the saved mode or another Agent's default. A healthy Extension-mode browser-use daemon persists and is reused after the command exits. Sequential Agents share its current-page state; simultaneous canonical runs are serialized or fail busy. User release, authorization loss, Extension/Native Host disconnect, or WebSocket loss removes browser authority even if the detached browser-use process remains alive.

The adapter disables browser-use telemetry and automatic recording for this lane and confines its daemon log and temporary artifacts to protected Panerelay-owned storage. Full Panerelay uninstall removes the owned adapter, mode, Skill, launchers, configuration, runtime, and temporary files; it does not kill processes by a broad command-line pattern.

Omitting an action runs base `setup` and installs only the Native Messaging host and side-panel prerequisites. Add `--agent-browser`, `--browser-use`, or both to install either engine integration explicitly.

```bash
npx --yes @panerelay/setup --agent-browser --browser-use
```

Use Panerelay explicitly:

```bash
agent-browser --provider panerelay tab list
```

When Chrome and Edge are both connected, inspect or save the browser used by unscoped Provider invocations:

```bash
npx --yes @panerelay/cli browsers
npx --yes @panerelay/cli browser use chrome
# Or use an exact registration ID:
# npx --yes @panerelay/cli browser use REGISTRATION_ID
npx --yes @panerelay/cli browser clear
```

`@panerelay/cli` is an optional, engine-neutral administration package. Install it globally when a persistent `panerelay` command is useful. Setup does not install it globally or modify the shell `PATH`.

`PANERELAY_BROWSER_ID` selects one exact registration for a process. `PANERELAY_BROWSER` accepts an exact ID or an unambiguous browser family. Explicit selection wins over the saved browser default. Without either, Panerelay selects only when exactly one CDP-ready browser is live; ambiguity and unavailable defaults fail closed. Existing sessions remain pinned to the browser through which they were created.

Or choose a default scope:

```bash
# Default for the current project
npx --yes @panerelay/setup --agent-browser --project-provider

# Default for the current user
npx --yes @panerelay/setup --agent-browser --global-provider

# Configure both scopes
npx --yes @panerelay/setup --agent-browser --project-provider --global-provider
```

The corresponding doctor flags verify the requested defaults:

```bash
npx --yes @panerelay/setup doctor --agent-browser --project-provider --global-provider
```

Human-readable setup output follows the system language when it resolves to Chinese or English. Override it per command with `--lang zh-CN` or `--lang en`, or set `PANERELAY_LANG`. The machine-readable `doctor --json` schema and values remain stable.

Browser authorization remains controlled by the user in the Panerelay side panel. Provider and browser-default configuration cannot grant access to a tab or widen its authorization scope. A side-panel Agent explicitly uses the browser containing that side panel rather than the saved default.

Official Extension artifacts use ID `panplnkjlkoceaonlmpdekjphgmbggmi`. Self-built or differently signed Extensions can use:

```bash
npx --yes @panerelay/setup --extension-id <32-character-id>
```

`PANERELAY_EXTENSION_ID` is the environment alternative. CLI input takes precedence over the environment, then the persisted installation ID, then the official default. The value must contain exactly 32 lowercase letters from `a` through `p`. Update preserves a persisted custom ID unless a new CLI or environment override is supplied; use the same option with `doctor` to diagnose an intentional replacement.

`update` is an alias of `setup` and replaces only the Panerelay-managed files selected by the same explicit flags:

```bash
npx --yes @panerelay/setup update --agent-browser --global-provider
```

To roll back, run an earlier setup package and reload the matching unpacked Extension. Do not mix Extension and package versions. Native Messaging installation supports Chrome and Edge on macOS, Linux, and current-user Windows without administrator privileges. Windows doctor reports each browser's registration independently. agent-browser 0.33.0 or newer is required only with `--agent-browser`, and its detected version appears only in `doctor --agent-browser`.

Claude Code and Qoder are optional. Setup discovers `claude` and a compatible `qodercli --acp`, then exposes available providers alongside Codex. A missing optional runtime is reported as a warning and does not make the core installation unhealthy.
