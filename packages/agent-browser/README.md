# @panerelay/agent-browser

Browser Provider adapter that lets agent-browser use explicitly authorized tabs in a running
Chrome profile through PaneRelay.

The adapter preserves standard agent-browser command semantics. PaneRelay supplies the connection,
authorization boundary, and exclusive control lease; it does not grant tab access by installing
this package.

Install and register the Provider through `@panerelay/setup`. The first alpha is verified against
agent-browser 0.33.0.
