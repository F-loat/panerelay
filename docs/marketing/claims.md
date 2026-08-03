# Marketing claim register

Last reviewed: 2026-08-04

Re-check external sources before publishing time-sensitive comparisons. “Documented” means the linked source states the behavior. “Inference” means the wording is a bounded conclusion from documented behavior and must be presented as such.

## Panerelay

| Public wording | Status | Evidence |
| --- | --- | --- |
| agent-browser accepts a configured `browser.provider` plugin name through its provider setting. | Documented upstream capability | [agent-browser configuration](https://agent-browser.dev/configuration), [upstream repository](https://github.com/vercel-labs/agent-browser) |
| Users can authorize the current tab or all supported web tabs. | Documented and implemented | [RFC-0001](../rfcs/0001-extension-connection-and-agent-interoperability.md#browser-authorization-scopes) |
| Authorization scope and active control are separate; Release ends the lease without clearing the selected scope. | Documented and implemented | [RFC-0001](../rfcs/0001-extension-connection-and-agent-interoperability.md#browser-authorization-scopes), [RFC-0003](../rfcs/0003-control-session-lifecycle-and-activity.md) |
| agent-browser 0.33.0 is the accepted minimum and exact Chrome evidence baseline. | Documented | [agent-browser compatibility](../compatibility/agent-browser-0.33.0.md) |
| Browser Use 0.13.7 with Browser Harness 0.1.8 is the exact evidence baseline for the supported CLI and CLI MCP path. | Documented | [Browser Use compatibility](../compatibility/browser-use-0.13.7.md) |
| Playwright CLI 0.1.17 is the exact explicit-CDP evidence baseline. | Documented | [Playwright CLI compatibility](../compatibility/playwright-cli-0.1.17.md) |
| Chrome groups with recorded daily-browser evidence are Verified; Edge remains Forwarded where representative runtime evidence is incomplete. | Documented | [browser-platform compatibility](../compatibility/browser-platforms.md) |
| Panerelay does not own isolated profiles, launch-time proxies, browser contexts, or browser-process shutdown. | Documented | [RFC-0002](../rfcs/0002-browser-level-cdp-and-agent-browser-compatibility.md) |

## Raw Chrome DevTools Protocol attachment

| Public wording | Status | Evidence |
| --- | --- | --- |
| From Chrome 136, remote-debugging switches are not honored against the default Chrome data directory unless a non-standard `--user-data-dir` is supplied. | Documented | [Chrome for Developers](https://developer.chrome.com/blog/remote-debugging-port) |
| Chrome recommends a custom data directory for debugging and Chrome for Testing for browser automation scenarios. | Documented | [Chrome for Developers](https://developer.chrome.com/blog/remote-debugging-port) |
| A raw CDP endpoint is a browser debugging transport, not a user-facing current-tab/all-tabs authorization manager. | Inference | Derived from Chrome's remote-debugging documentation and CDP endpoint model. Phrase as a difference in product layer, not as a protocol defect. |
| “CDP requires a confirmation popup on every connection.” | Do not use | This is not true for every raw-CDP setup and conflates raw debugging with extension-mediated connection approval. |

## Playwright Chrome Extension / Playwright MCP

| Public wording | Status | Evidence |
| --- | --- | --- |
| The extension connects Playwright MCP to existing browser tabs and reuses the default profile's logged-in state. | Documented | [Playwright extension README](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md), [Playwright MCP](https://github.com/microsoft/playwright-mcp) |
| On first interaction, the user is shown a page for selecting which browser tab the LLM connects to. | Documented | [Playwright extension README](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md#browser-tab-selection) |
| Connection approval is required by default; a profile-specific token can bypass repeated approval. | Documented | [Playwright extension README](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md#bypassing-the-connection-approval-dialog) |
| Panerelay differs by presenting current-tab and all-supported-tabs as explicit durable authorization choices and active control as a separate releasable lease. | Panerelay fact plus comparison | Use the Playwright sources above together with [RFC-0001](../rfcs/0001-extension-connection-and-agent-interoperability.md#browser-authorization-scopes). |
| “Playwright is limited to one tab.” | Do not use | The extension begins with a selected tab, but Playwright exposes tab management after connection. |

## Managed, isolated, and Browser Use browser modes

| Public wording | Status | Evidence |
| --- | --- | --- |
| Playwright MCP supports persistent profiles, isolated sessions, CDP endpoints, and its browser extension as separate connection choices. | Documented | [Playwright MCP README](https://github.com/microsoft/playwright-mcp#browser-extension) |
| Browser Use CLI supports managed headless Chromium, real Chrome with existing profiles, cloud browsers, and direct CDP URLs. | Documented | [Browser Use CLI](https://docs.browser-use.com/open-source/browser-use-cli) |
| Managed or isolated browsers are often the better fit when a clean environment, process ownership, repeatability, proxy configuration, or remote scale is required. | Inference | This is a best-fit interpretation of the documented modes. Present it as guidance, not a limitation claim. |
| Panerelay is aimed at the different case where the user's already-open browser, tabs, extensions, and login state are the desired environment. | Product position | [Website](https://f-loat.github.io/panerelay/), [RFC-0001](../rfcs/0001-extension-connection-and-agent-interoperability.md) |

## Compatibility review result

This marketing change does not alter an automation surface or compatibility classification. The affected records remain:

- agent-browser 0.33.0: accepted minimum and exact Chrome evidence baseline.
- Browser Use 0.13.7 / Browser Harness 0.1.8: exact supported CLI and CLI MCP evidence baseline.
- Playwright CLI 0.1.17: exact explicit-CDP evidence baseline.
- Chrome: use each record's existing `Verified` groups.
- Edge: retain `Forwarded` wherever the browser-platform and integration records say representative runtime evidence is pending.
