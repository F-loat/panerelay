# @panerelay/agent-browser

Browser Provider adapter that lets agent-browser use explicitly authorized tabs in a running
Chrome profile through Panerelay.

The adapter preserves standard agent-browser command semantics. Panerelay supplies the connection,
authorization boundary, and exclusive control lease; it does not grant tab access by installing
this package.

Install and register the Provider through `@panerelay/setup`. Use
`agent-browser --provider panerelay ...` explicitly, or configure a project/user default with
`npx --yes @panerelay/setup --project-provider` or
`npx --yes @panerelay/setup --global-provider`. Provider selection does not authorize a browser
tab.

agent-browser 0.33.0 is the minimum supported version and initial verified baseline. Newer versions
satisfy the version floor but need their own compatibility evidence before being classified as
verified.
