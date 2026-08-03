# Panerelay documentation

English ｜ [简体中文](README.zh-CN.md)

Start with the path that matches what you are trying to do. Product setup and user actions stay short; implementation evidence and architecture decisions live in their dedicated records.

## Get started

| Goal | Start here |
| --- | --- |
| Understand Panerelay and install it | [English quickstart](../README.md#quickstart) |
| Let an Agent configure Panerelay and an automation tool | [Agent setup instructions](agent-setup.md) |
| Install only Panerelay for the browser side panel | [`@panerelay/setup` start guide](../packages/setup/README.md#start-here) |
| Use agent-browser with authorized existing-browser tabs | [agent-browser integration guide](../packages/agent-browser/README.md) |
| Use browser-use CLI, Skill, or CLI MCP with authorized Chrome tabs | [browser-use integration guide](../packages/browser-use/README.md) |
| Explicitly attach Playwright CLI to authorized Chrome tabs | [Playwright CLI integration guide](../packages/playwright/README.md) |

The published Agent guide is available at <https://f-loat.github.io/panerelay/agent-setup.md> so an Agent can fetch one stable, reviewable instruction file.

## Operate and troubleshoot

- [`@panerelay/setup` technical reference](../packages/setup/README.md#technical-cli-reference): integration flags, doctor checks, Provider defaults, custom Extension IDs, browser-use connection modes, updates, and uninstall.
- [`@panerelay/cli` reference](../packages/cli/README.md): list connected browsers and choose the routing default.
- [`@panerelay/bridge` overview](../packages/bridge/README.md): local Native Host, Agent runtime, and routing boundary.

## Compatibility evidence

Compatibility records describe tested versions and capability classifications. A supported minimum is not automatically an exact verified baseline.

- [Browser platforms](compatibility/browser-platforms.md): Chrome and Microsoft Edge classifications.
- [agent-browser 0.33.0](compatibility/agent-browser-0.33.0.md): Provider behavior and command coverage.
- [browser-use 0.13.7](compatibility/browser-use-0.13.7.md): Browser Harness 0.1.8 baseline, supported surfaces, lifecycle, and limits.
- [Playwright CLI 0.1.17](compatibility/playwright-cli-0.1.17.md): explicit CDP attach, command groups, lifecycle, and browser-owned limits.
- [Claude Code](compatibility/claude-code.md): supported local Agent runtime boundary.

## Architecture and security decisions

Accepted [RFCs](rfcs/README.md) are the durable source for cross-package boundaries, authorization, control ownership, browser routing, and third-party integrations. Start with:

- [RFC-0001: Extension connection and Agent interoperability](rfcs/0001-extension-connection-and-agent-interoperability.md)
- [RFC-0003: Control session lifecycle and activity](rfcs/0003-control-session-lifecycle-and-activity.md)
- [RFC-0004: Read observation and active browser control](rfcs/0004-read-observation-and-active-browser-control.md)

## Development evidence

- [Spikes](spikes): bounded experiments and reproducible compatibility probes.
- [Release checklist](releasing.md): lockstep package and Extension release verification.

Panerelay does not commit generated browser screenshots, logs, credentials, or machine-specific verification output to this documentation tree.
