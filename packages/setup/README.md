# @panerelay/setup

Local setup and diagnostics for Panerelay.

## Commands

Install the official [Panerelay Extension from the Chrome Web Store](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) in Chrome or Edge, or temporarily load the Firefox package from the matching release for release-candidate testing, then configure the local integration with the commands below.

Panerelay components are published in lockstep. Use the same version as the Panerelay Extension:

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
npx --yes @panerelay/setup uninstall --yes
```

Omitting an action runs `setup`. It installs the Native Messaging host, registers the `panerelay` plugin in the user-level agent-browser config, and installs the `panerelay-browser` Agent Skill. When Firefox and geckodriver are discoverable, setup also installs a separate per-user `panerelay-firefox` launcher (`panerelay-firefox.cmd` on Windows). It does not start or close Firefox, change normal browser shortcuts, or change the default agent-browser Provider unless requested.

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

Official Firefox artifacts use add-on ID `panerelay@f-loat.dev`. A self-built or differently signed Firefox Extension can use:

```bash
npx --yes @panerelay/setup --firefox-extension-id <add-on-id>
```

`PANERELAY_FIREFOX_EXTENSION_ID` is the environment alternative and follows the same CLI, environment, persisted-value, official-default precedence. Setup writes Chromium `allowed_origins` manifests and Firefox `allowed_extensions` manifests to each browser's per-user discovery locations.

Firefox automation is opt-in. Close normally started Firefox instances once, then launch `~/.panerelay/bin/panerelay-firefox` on macOS/Linux or `%USERPROFILE%\.panerelay\bin\panerelay-firefox.cmd` on Windows. The launcher accepts no browser arguments and starts only the configured Firefox with `--marionette` plus an optional validated absolute profile path. Override discovery before setup with `PANERELAY_FIREFOX_PATH`, `PANERELAY_GECKODRIVER_PATH`, `PANERELAY_FIREFOX_PROFILE`, or `PANERELAY_FIREFOX_MARIONETTE_PORT`.

`update` is an alias of `setup` and safely replaces Panerelay-managed Native Host, Provider, and Skill files:

```bash
npx --yes @panerelay/setup update --global-provider
```

To roll back, run an earlier setup package and reload the matching unpacked Extension. Do not mix Extension and package versions. `update` replaces only Panerelay-managed launchers and configuration; `uninstall` removes those files without deleting Firefox, profiles, or normal shortcuts. Native Messaging installation supports macOS, Linux, and current-user Windows registration for Chrome-family browsers, Microsoft Edge, and Firefox without administrator privileges.

agent-browser 0.33.0 or newer remains the Chrome/Edge automation floor. Firefox uses WebDriver rather than CDP and additionally requires the `browser.provider.webdriver-existing-session` Provider capability. No released semantic minimum is named until agent-browser ships that contract; the pinned development patch and current evidence are documented in [Firefox WebDriver development compatibility](../../docs/compatibility/firefox-webdriver-development.md). An unpatched 0.33.x client remains usable for Chrome/Edge and fails before Firefox allocates a participant.

Claude Code and Qoder are optional. Setup discovers `claude` and a compatible `qodercli --acp`, then exposes available providers alongside Codex. A missing optional runtime is reported as a warning and does not make the core installation unhealthy.
