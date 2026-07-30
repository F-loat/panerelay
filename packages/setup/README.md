# @panerelay/setup

Local setup and diagnostics for PaneRelay.

## Commands

PaneRelay `0.1.0` is a lockstep release. Use the same version as the PaneRelay Extension:

```bash
npx --yes @panerelay/setup@0.1.0 setup
npx --yes @panerelay/setup@0.1.0 doctor
npx --yes @panerelay/setup@0.1.0 uninstall --yes
```

`setup` installs the Native Messaging host, registers the `panerelay` plugin in the
user-level agent-browser config, and installs the `panerelay-browser` Agent Skill. It does
not change the default agent-browser Provider unless requested.

Use PaneRelay explicitly:

```bash
agent-browser --provider panerelay snapshot -i
```

Or choose a default scope:

```bash
# Default for the current project
npx --yes @panerelay/setup@0.1.0 setup --project

# Default for the current user
npx --yes @panerelay/setup@0.1.0 setup --global-provider

# Configure both scopes
npx --yes @panerelay/setup@0.1.0 setup --project --global-provider
```

The corresponding doctor flags verify the requested defaults:

```bash
npx --yes @panerelay/setup@0.1.0 doctor --project --global-provider
```

Human-readable CLI output follows the system language when it resolves to Chinese or English.
Override it per command with `--lang zh-CN` or `--lang en`, or set `PANERELAY_LANG`. The
machine-readable `doctor --json` schema and values remain stable.

Browser authorization remains controlled by the user in the PaneRelay side panel.
Provider configuration cannot grant access to a tab or widen its authorization scope.

Official Extension artifacts use ID `panplnkjlkoceaonlmpdekjphgmbggmi`. Self-built or differently
signed Extensions can use:

```bash
npx --yes @panerelay/setup@0.1.0 setup --extension-id <32-character-id>
```

`PANERELAY_EXTENSION_ID` is the environment alternative. CLI input takes precedence over the
environment, then the persisted installation ID, then the official default. The value must contain
exactly 32 lowercase letters from `a` through `p`. Update preserves a persisted custom ID unless a
new CLI or environment override is supplied; use the same option with `doctor` to diagnose an
intentional replacement.

`update` is an alias of `setup` and safely replaces PaneRelay-managed Native Host, Provider, and
Skill files:

```bash
npx --yes @panerelay/setup@0.1.0 update --global-provider
```

To roll back, run an earlier setup package and reload the matching unpacked Extension. Do not mix
Extension and package versions. Native Messaging installation supports macOS, Linux, and
current-user Windows Chrome registration without administrator privileges. agent-browser 0.33.0
or newer is required and its detected version appears in doctor.

Qoder is optional. When setup discovers a compatible `qodercli --acp`, the side panel exposes it
alongside Codex; a missing Qoder runtime is reported as a warning and does not make the core
installation unhealthy.
