# @panerelay/setup

Local setup and diagnostics for Panerelay.

## Commands

Install the official [Panerelay Extension from the Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) in Chrome or Microsoft Edge, then configure the local integration with the commands below. Edge may first ask you to allow extensions from other stores.

Panerelay components are published in lockstep. Use the same version as the Panerelay Extension:

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
npx --yes @panerelay/setup uninstall --yes
```

### Optional Browser Use integration

Browser Use `0.13.7` or newer can use the existing Chrome session through an
opt-in Extension-backed lane:

```bash
npx --yes @panerelay/setup --browser-use
npx --yes @panerelay/setup doctor --browser-use
```

Setup does not install, upgrade, downgrade, or rewrite Browser Use. It verifies
the installed versions, installs a private Panerelay CLI and adapter under
`~/.panerelay`, records the exact compatible executable, and installs an
additive `panerelay-browser-use` Skill without replacing the official Browser
Use Skill or changing `PATH`. Setup initially saves Extension mode. The setup
output also prints an optional CLI MCP launcher. If the Browser Use environment
is incomplete, setup asks the user to repair or upgrade Browser Use as one
installation.

The private CLI supports a durable Panerelay-owned mode and a one-run override:

```bash
~/.panerelay/bin/panerelay-browser-use-cli connection use browser-use extension
~/.panerelay/bin/panerelay-browser-use-cli connection use browser-use direct
~/.panerelay/bin/panerelay-browser-use-cli run browser-use --mode extension -- /absolute/path/to/browser-use
~/.panerelay/bin/panerelay-browser-use-cli run browser-use --mode direct -- /absolute/path/to/browser-use
```

These paths are POSIX examples; use the exact launchers printed by setup on the
current platform. One-run overrides do not change the saved mode or another
Agent's default. A healthy Extension-mode Browser Use daemon persists and is
reused after the command exits. Sequential Agents share its current-page state;
simultaneous canonical runs are serialized or fail busy. User release,
authorization loss, Extension/Native Host disconnect, or WebSocket loss removes
browser authority even if the detached Browser Use process remains alive.

The adapter disables Browser Use telemetry and automatic recording for this
lane and confines its daemon log and temporary artifacts to protected
Panerelay-owned storage. Full Panerelay uninstall removes the owned adapter,
mode, Skill, launchers, configuration, runtime, and temporary files; it does
not kill processes by a broad command-line pattern.

Omitting an action runs `setup`. It installs the Native Messaging host, registers the `panerelay` plugin in the user-level agent-browser config, and installs the `panerelay-browser` Agent Skill. It does not change the default agent-browser Provider unless requested. Browser Use integration remains opt-in through `--browser-use`.

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

`@panerelay/cli` is an optional, engine-neutral administration package. Install
it globally when a persistent `panerelay` command is useful. Setup does not
install it globally or modify the shell `PATH`.

`PANERELAY_BROWSER_ID` selects one exact registration for a process. `PANERELAY_BROWSER` accepts an exact ID or an unambiguous browser family. Explicit selection wins over the saved browser default. Without either, Panerelay selects only when exactly one CDP-ready browser is live; ambiguity and unavailable defaults fail closed. Existing sessions remain pinned to the browser through which they were created.

Or choose a default scope:

```bash
# Default for the current project
npx --yes @panerelay/setup --project-provider

# Default for the current user
npx --yes @panerelay/setup --global-provider

# Configure both scopes
npx --yes @panerelay/setup --project-provider --global-provider
```

The corresponding doctor flags verify the requested defaults:

```bash
npx --yes @panerelay/setup doctor --project-provider --global-provider
```

Human-readable setup output follows the system language when it resolves to Chinese or English. Override it per command with `--lang zh-CN` or `--lang en`, or set `PANERELAY_LANG`. The machine-readable `doctor --json` schema and values remain stable.

Browser authorization remains controlled by the user in the Panerelay side panel. Provider and browser-default configuration cannot grant access to a tab or widen its authorization scope. A side-panel Agent explicitly uses the browser containing that side panel rather than the saved default.

Official Extension artifacts use ID `panplnkjlkoceaonlmpdekjphgmbggmi`. Self-built or differently signed Extensions can use:

```bash
npx --yes @panerelay/setup --extension-id <32-character-id>
```

`PANERELAY_EXTENSION_ID` is the environment alternative. CLI input takes precedence over the environment, then the persisted installation ID, then the official default. The value must contain exactly 32 lowercase letters from `a` through `p`. Update preserves a persisted custom ID unless a new CLI or environment override is supplied; use the same option with `doctor` to diagnose an intentional replacement.

`update` is an alias of `setup` and safely replaces Panerelay-managed Native Host, Provider, and Skill files:

```bash
npx --yes @panerelay/setup update --global-provider
```

To roll back, run an earlier setup package and reload the matching unpacked Extension. Do not mix Extension and package versions. Native Messaging installation supports Chrome and Edge on macOS, Linux, and current-user Windows without administrator privileges. Windows doctor reports each browser's registration independently. agent-browser 0.33.0 or newer is required and its detected version appears in doctor.

Claude Code and Qoder are optional. Setup discovers `claude` and a compatible `qodercli --acp`, then exposes available providers alongside Codex. A missing optional runtime is reported as a warning and does not make the core installation unhealthy.
