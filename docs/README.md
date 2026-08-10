# Panerelay documentation

English ｜ [简体中文](README.zh-CN.md)

Start with the path that matches what you are trying to do. Product setup and user actions stay short; implementation evidence and architecture decisions live in their dedicated records.

## Get started

| Goal | Start here |
| --- | --- |
| Understand Panerelay and install it | [English quickstart](../README.md#quickstart) |
| Let an Agent use Panerelay Fetch or configure an automation tool | [`panerelay` Skill](../skills/panerelay/SKILL.md) |
| Install only Panerelay for the browser side panel | [`@panerelay/setup` start guide](../packages/setup/README.md#start-here) |
| Use agent-browser with authorized existing-browser tabs | [agent-browser integration guide](../packages/adapters/agent-browser/README.md) |
| Use browser-use CLI, Skill, or CLI MCP with authorized Chrome tabs | [browser-use integration guide](../packages/adapters/browser-use/README.md) |
| Explicitly attach Playwright CLI to authorized Chrome tabs | [Playwright CLI integration guide](../packages/adapters/playwright/README.md) |
| Send browser-backed requests or use site adapters | [Browser-backed fetch](../README.md#browser-backed-fetch) |

Install the unified Agent workflow with `npx skills add F-loat/panerelay --skill panerelay`. The Skill is the version-controlled source for browser-authenticated Fetch, Agent routing, and agent-browser, Browser Use, and Playwright CLI setup, use, verification, and troubleshooting.

## Operate and troubleshoot

- [`@panerelay/setup` technical reference](../packages/setup/README.md#technical-cli-reference): integration flags, doctor checks, Provider defaults, custom Extension IDs, browser-use connection modes, updates, and uninstall.
- [`@panerelay/cli` reference](../packages/cli/README.md): list connected browsers and choose the routing default.
- [`@panerelay/bridge` overview](../packages/bridge/README.md): local Native Host, Agent runtime, and routing boundary.

## Compatibility evidence

Compatibility records describe tested versions and capability classifications. A supported minimum is not automatically an exact verified baseline.

- [Browser platforms](compatibility/browser-platforms.md): Chrome and Microsoft Edge classifications.
- [Native Host self-update](compatibility/native-host-self-update.md): non-blocking release comparison, stable launcher, recovery, and retained platform evidence.
- [agent-browser 0.33.0](compatibility/agent-browser-0.33.0.md): Provider behavior and command coverage.
- [browser-use 0.13.7](compatibility/browser-use-0.13.7.md): Browser Harness 0.1.8 baseline, supported surfaces, lifecycle, and limits.
- [Playwright CLI 0.1.17](compatibility/playwright-cli-0.1.17.md): explicit CDP attach, command groups, lifecycle, and browser-owned limits.
- [Browser-backed fetch](compatibility/browser-fetch.md): raw fetch and site-adapter classifications, evidence, and boundaries.
- [Claude Code](compatibility/claude-code.md): supported local Agent runtime boundary.
- [OpenCode 1.18.12](compatibility/opencode-1.18.12.md): ACP Side Panel provider capabilities and limits.

## Architecture and security decisions

Accepted [RFCs](rfcs/README.md) are the durable source for cross-package boundaries, authorization, control ownership, browser routing, and third-party integrations. Start with:

- [RFC-0001: Extension connection and Agent interoperability](rfcs/0001-extension-connection-and-agent-interoperability.md)
- [RFC-0003: Control session lifecycle and activity](rfcs/0003-control-session-lifecycle-and-activity.md)
- [RFC-0004: Read observation and active browser control](rfcs/0004-read-observation-and-active-browser-control.md)

## Development evidence

- [Spikes](spikes): bounded experiments and reproducible compatibility probes.
- [Release checklist](releasing.md): lockstep package and Extension release verification.

Panerelay does not commit generated browser screenshots, logs, credentials, or machine-specific verification output to this documentation tree.
