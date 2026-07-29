# @panerelay/setup

Local setup and diagnostics for PaneRelay.

## Commands

The first alpha is a lockstep release. Use the exact same version as the PaneRelay Extension:

```bash
npx --yes @panerelay/setup@0.1.0-alpha.1 setup
npx --yes @panerelay/setup@0.1.0-alpha.1 doctor
npx --yes @panerelay/setup@0.1.0-alpha.1 uninstall --yes
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
npx --yes @panerelay/setup@0.1.0-alpha.1 setup --project

# Default for the current user
npx --yes @panerelay/setup@0.1.0-alpha.1 setup --global-provider

# Configure both scopes
npx --yes @panerelay/setup@0.1.0-alpha.1 setup --project --global-provider
```

The corresponding doctor flags verify the requested defaults:

```bash
npx --yes @panerelay/setup@0.1.0-alpha.1 doctor --project --global-provider
```

Human-readable CLI output follows the system language when it resolves to Chinese or English.
Override it per command with `--lang zh-CN` or `--lang en`, or set `PANERELAY_LANG`. The
machine-readable `doctor --json` schema and values remain stable.

Browser authorization remains controlled by the user in the PaneRelay side panel.
Provider configuration cannot grant access to a tab or widen its authorization scope.

`update` is an alias of `setup` and safely replaces PaneRelay-managed Native Host, Provider, and
Skill files:

```bash
npx --yes @panerelay/setup@0.1.0-alpha.1 update --global-provider
```

To roll back, run an earlier setup package and reload the matching unpacked Extension. Do not mix
alpha Extension and package versions. Native Messaging installation currently supports macOS and
Linux; unsupported platforms fail without claiming readiness.
