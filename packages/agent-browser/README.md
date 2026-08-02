# `@panerelay/agent-browser`

**Agent Use Browser with agent-browser.** Use explicitly authorized tabs from the Chrome or Microsoft Edge profile you already use. Panerelay supplies the existing-browser connection, authorization boundary, and visible control lease; agent-browser keeps its normal CLI and MCP commands.

This is an explicit Panerelay external-automation integration, at the same setup level as browser-use.

## Requirements

- Chrome or Microsoft Edge with the Panerelay Extension installed
- Node.js 20+
- agent-browser 0.33.0 or newer

## Ask your Agent to set it up

```text
Set up Panerelay so my Agent can use agent-browser with my existing Chrome or Edge browser. Inspect the local environment first. Install or update agent-browser from its official source only if needed, then use Panerelay's official setup tool to enable the agent-browser integration. Run the relevant Panerelay doctor check and verify that agent-browser can list only the tabs I authorize. Do not change unrelated Agent settings, and ask me to authorize a tab in the Panerelay extension when required.
```

Success means agent-browser lists only the tabs authorized in the selected Panerelay browser. Setup and Provider selection do not grant site permission or authorize a tab.

## Technical CLI reference

```bash
npx --yes @panerelay/setup --agent-browser
npx --yes @panerelay/setup doctor --agent-browser
```

After the user authorizes the current tab or supported web tabs in the Extension, verify the connection:

```bash
agent-browser --provider panerelay tab list
```

## Use and defaults

Run standard agent-browser commands with `--provider panerelay`. To omit that flag, configure a project or user default:

```bash
npx --yes @panerelay/setup --agent-browser --project-provider
npx --yes @panerelay/setup --agent-browser --global-provider
```

When more than one Panerelay browser is connected, choose one explicitly:

```bash
npx --yes @panerelay/cli browsers
npx --yes @panerelay/cli browser use chrome
```

An unavailable default or ambiguous choice fails closed. Every launched session stays pinned to its selected browser, including cleanup.

## Compatibility

agent-browser 0.33.0 is both the minimum supported version and the exact initial Chrome-verified baseline. Newer versions meet the version floor but need their own evidence before being classified as `Verified`. Edge uses the same Chromium Provider path and remains `Forwarded` until dedicated representative evidence is recorded.

- [Upstream agent-browser documentation](https://agent-browser.dev/)
- [Panerelay agent-browser 0.33.0 compatibility record](../../docs/compatibility/agent-browser-0.33.0.md)
- [Browser platform compatibility record](../../docs/compatibility/browser-platforms.md)

This package is registered only by `@panerelay/setup --agent-browser`; Agents do not invoke it directly.
