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

Omitting an action runs `setup`. It installs the Native Messaging host, registers the `panerelay` plugin in the user-level agent-browser config, and installs the `panerelay-browser` Agent Skill. It does not change the default agent-browser Provider unless requested.

Use Panerelay explicitly:

```bash
agent-browser --provider panerelay tab list
```

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

Human-readable CLI output follows the system language when it resolves to Chinese or English. Override it per command with `--lang zh-CN` or `--lang en`, or set `PANERELAY_LANG`. The machine-readable `doctor --json` schema and values remain stable.

Browser authorization remains controlled by the user in the Panerelay side panel. Provider configuration cannot grant access to a tab or widen its authorization scope.

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
