# `@panerelay/agent-browser`

Use agent-browser with the Chrome or Microsoft Edge session you already use. Choose the current tab for focused work or all supported web tabs for cross-page workflows; Panerelay keeps active control separately visible and releasable while agent-browser retains its normal CLI and MCP commands, waits, and page-state semantics.

This is an opt-in **automation tool integration**. It is a peer of the browser-use integration and is not installed by the engine-neutral Panerelay setup command.

## Before you start

- Install the official [Panerelay Extension](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) in Chrome or Microsoft Edge.
- Install Node.js 20 or newer.
- Install agent-browser 0.33.0 or newer by following the [upstream installation instructions](https://agent-browser.dev/installation).

Panerelay setup verifies agent-browser but does not install, update, downgrade, or add it to `PATH`.

## Set up with your Agent

Install the unified Skill, then ask your Agent to use its agent-browser workflow:

```bash
npx skills add https://github.com/F-loat/panerelay --skill panerelay
```

The Skill defines environment inspection, official upstream installation when needed, Panerelay integration, the user authorization stop, verification, and troubleshooting.

## Set up manually

After `agent-browser --version` reports a supported version, install and diagnose the Panerelay integration:

```bash
npx --yes @panerelay/setup --agent-browser
npx --yes @panerelay/setup doctor --agent-browser
```

Open Panerelay in the browser and choose current-tab or all-supported-tabs authorization for the task. Then verify the selected authorization boundary:

```bash
agent-browser --provider panerelay tab list
```

Success means the doctor checks pass and agent-browser lists only the tabs authorized in the selected Panerelay browser. Setup and Provider selection never grant site permission or authorize a tab.

## What setup adds

`@panerelay/setup --agent-browser` installs the Panerelay Provider and registers the exact compatible integration. The independently managed `panerelay` Skill tells Agents how to use it; this package remains a setup-managed runtime and is not intended to be invoked directly by Agents.

## Daily use and defaults

Use standard agent-browser commands with `--provider panerelay`. If you explicitly want Panerelay as the user-level default:

```bash
npx --yes @panerelay/setup --agent-browser --global-default
```

Provider defaults change routing only. They do not grant browser permission, authorize a tab, or acquire the active control lease.

New Side Panel conversations may inject a reserved 56-character `panerelay-v2-...` session value for the originating tab. Use that exact value with `--session` and `--provider panerelay`; it stays within agent-browser 0.33.0's session-name limit while the Provider selects the named live browser and orders the already-authorized target as agent-browser's local `t1`. Do not construct or shorten the value manually or substitute a similar URL/title when it is unavailable. Malformed and legacy target values fail closed, while ordinary session names keep the existing default-browser and tab-order behavior.

When more than one Panerelay browser is connected, choose one in Extension settings or with the CLI installed by base Setup:

```bash
panerelay browsers
panerelay browser use chrome
```

An unavailable default or ambiguous browser choice fails closed. Every launched session remains pinned to the browser through which it was created, including cleanup.

## Compatibility and limits

agent-browser 0.33.0 is both the minimum supported version and the exact initial Chrome-verified baseline. Newer versions meet the version floor but require their own evidence before being classified as `Verified`. Microsoft Edge uses the same Chromium Provider path and remains `Forwarded` until representative evidence is recorded.

Panerelay operates only authorized tabs. It does not own browser-process features such as isolated profiles, launch-time proxy changes, or closing the user's browser process.

- [Upstream agent-browser documentation](https://agent-browser.dev/)
- [Panerelay agent-browser 0.33.0 compatibility record](../../../docs/compatibility/agent-browser-0.33.0.md)
- [Browser platform compatibility record](../../../docs/compatibility/browser-platforms.md)
- [`@panerelay/setup` technical reference](../../setup/README.md)
