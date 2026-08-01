# `@panerelay/browser-use`

Optional Browser Use connection adapter for Panerelay.

This package is installed and registered by Panerelay setup when the Browser
Use integration is explicitly selected. It supplies connection environment to
the engine-neutral Panerelay CLI; Browser Use remains responsible for
automation behavior.

The adapter is not a replacement `browser-use` command and is not intended to
be invoked directly by Agents. It does not install or modify Browser Use.

Browser Use `0.13.7` or newer is required. Select the integration explicitly
during setup:

```bash
npx --yes @panerelay/setup --browser-use
npx --yes @panerelay/setup doctor --browser-use
```

Setup installs a protected adapter, private Panerelay CLI, additive Skill, and
CLI MCP launcher without changing `PATH` or the official Browser Use Skill. It
records the detected Browser Use executable, isolates its private runtime and
temporary files, and disables telemetry and automatic recording for the
Extension-backed lane.

Extension mode uses only explicitly authorized tabs. Unsupported browser-wide,
whole-profile, isolated-context, and top-level containment operations fail
explicitly. Sequential commands reuse one persistent Browser Use daemon and
therefore share current-page state; simultaneous canonical runs are serialized
or fail busy.

See the [version-specific compatibility record](../../docs/compatibility/browser-use-0.13.7.md).
