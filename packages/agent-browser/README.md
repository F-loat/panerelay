# @panerelay/agent-browser

Browser Provider adapter that lets agent-browser use explicitly authorized tabs in a running Chrome or Microsoft Edge profile through Panerelay.

The adapter preserves standard agent-browser command semantics. Panerelay supplies the connection, authorization boundary, and exclusive control lease; it does not grant tab access by installing this package.

Install and register the Provider through `@panerelay/setup`. Use `agent-browser --provider panerelay ...` explicitly, or configure a project/user default with `npx --yes @panerelay/setup --project-provider` or `npx --yes @panerelay/setup --global-provider`. Provider selection does not authorize a browser tab.

When more than one Panerelay browser is connected, set the user browser default
with `npx --yes @panerelay/cli browser use
<registration-id|chrome|edge>` (or the globally installed `panerelay` command),
or scope one invocation with `PANERELAY_BROWSER_ID` /
`PANERELAY_BROWSER`. An unavailable default or ambiguous choice fails closed.
Every launched session stays pinned to its selected browser, including cleanup.

agent-browser 0.33.0 is the minimum supported version and initial Chrome-verified baseline. Edge uses the same Chromium Provider path but remains Forwarded until dedicated real-Edge evidence is recorded. Newer agent-browser versions satisfy the version floor but need their own compatibility evidence before being classified as verified.
