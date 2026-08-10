# `@panerelay/playwright`

Optional connection adapter for attaching the upstream Playwright CLI to an existing Chrome or Microsoft Edge session through Panerelay. Choose the current tab for focused work or all supported web tabs for cross-page workflows; active control remains separately visible and releasable. Chrome is the verified baseline; Edge remains `Forwarded` pending its complete command matrix.

## Setup and use

Install Playwright CLI 0.1.17 or newer separately, then run:

```bash
npx --yes @panerelay/setup --playwright
npx --yes @panerelay/setup doctor --playwright
playwright-cli attach --cdp http://127.0.0.1:43827/cdp/playwright
playwright-cli tab-list
playwright-cli tab-select <tab-id-from-tab-list>
playwright-cli tab-list
playwright-cli snapshot
```

Choose the intended authorized tab ID from the first `tab-list` result. After `tab-select`, run `tab-list` again and confirm the intended tab is selected before continuing.

New Side Panel conversations may instead inject a reserved 56-character `-s=panerelay-v2-...` session and a target-scoped `/cdp/playwright/target/...` attach URL. Use both exact values, then run `tab-list`, `tab-select 0`, and `tab-list` again. Panerelay validates the compact reversible browser/target pair against the current authorized inventory and exposes that page first without changing Playwright CLI. A malformed, legacy, stale, or unauthorized target fails closed; do not shorten the session, retry through the unscoped URL, or match URL/title.

The setup package verifies the upstream executable and installs only Panerelay-owned adapter metadata. It does not install a shim, modify `PATH` or shell startup files, write `.playwright/cli.config.json`, set Playwright as a default, or manage an Agent Skill. The independently installed `panerelay` Skill contains the Playwright workflow.

For explicit user-managed configuration, set `PLAYWRIGHT_MCP_CDP_ENDPOINT=http://127.0.0.1:43827/cdp/playwright` or configure `browser.cdpEndpoint` in `.playwright/cli.config.json`.

The connection exposes the authorization scope selected in Panerelay: the current tab or all supported existing Chromium tabs. Isolated BrowserContexts, browser launch options, proxy ownership, and whole-browser close are unsupported and fail explicitly.

- [Playwright CLI 0.1.17 compatibility record](../../../docs/compatibility/playwright-cli-0.1.17.md)
- [`@panerelay/setup` reference](../../setup/README.md)
