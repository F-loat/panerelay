# @panerelay/agent-browser

Browser Provider adapter that lets agent-browser use explicitly authorized tabs in a running Chrome, Microsoft Edge, or explicitly managed Firefox profile through Panerelay.

The adapter preserves standard agent-browser command semantics. Panerelay supplies the connection, authorization boundary, and exclusive control lease; it does not grant tab access by installing this package.

Install and register the Provider through `@panerelay/setup`. Use `agent-browser --provider panerelay ...` explicitly, or configure a project/user default with `npx --yes @panerelay/setup --project-provider` or `npx --yes @panerelay/setup --global-provider`. Provider selection does not authorize a browser tab.

agent-browser 0.33.0 is the minimum supported version and initial verified baseline for Chrome/Edge. Newer versions satisfy that version floor but need their own compatibility evidence before being classified as verified.

Firefox uses a distinct WebDriver Provider result with a participant-scoped relay URL and virtual session ID; it is never described as CDP-capable and never receives the raw geckodriver endpoint. The client must declare `browser.provider.webdriver-existing-session`. Until agent-browser publishes that contract, use the exact development patch recorded in the [Firefox WebDriver compatibility record](../../docs/compatibility/firefox-webdriver-development.md). Unpatched clients fail before Panerelay allocates a Firefox participant, without affecting Chrome/Edge.
