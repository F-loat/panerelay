# `@panerelay/playwright`

Optional connection adapter for attaching the upstream Playwright CLI to explicitly authorized tabs in an existing Chrome or Microsoft Edge session through Panerelay. Chrome is the verified baseline; Edge remains `Forwarded` pending its complete command matrix.

## Setup and use

Install Playwright CLI 0.1.17 or newer separately, then run:

```bash
npx --yes @panerelay/setup --playwright
npx --yes @panerelay/setup doctor --playwright
playwright-cli attach --cdp http://127.0.0.1:43827/cdp/playwright
playwright-cli tab-list
playwright-cli tab-select 1
playwright-cli snapshot
```

The setup package verifies the upstream executable and installs Panerelay-owned adapter metadata plus an additive `panerelay-playwright` Skill. It does not install a shim, modify `PATH` or shell startup files, write `.playwright/cli.config.json`, or set Playwright as a default.

For explicit user-managed configuration, set `PLAYWRIGHT_MCP_CDP_ENDPOINT=http://127.0.0.1:43827/cdp/playwright` or configure `browser.cdpEndpoint` in `.playwright/cli.config.json`.

The connection exposes only authorized existing Chromium tabs. Isolated BrowserContexts, browser launch options, proxy ownership, and whole-browser close are unsupported and fail explicitly.

- [Playwright CLI 0.1.17 compatibility record](../../docs/compatibility/playwright-cli-0.1.17.md)
- [`@panerelay/setup` reference](../setup/README.md)
