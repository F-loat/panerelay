# @panerelay/bridge

Panerelay's local Native Messaging host, Agent provider runtime, and browser automation policy boundary.

The Bridge connects the Panerelay Extension, agent-browser Provider, and local Agent runtimes over user-scoped local transports. It binds browser relay services to loopback, enforces the active control lease, and ships a bundled Native Host executable for installation by `@panerelay/setup` on macOS, Linux, and Windows. Its internal Agent provider registry supports Codex, a user-installed Claude Code CLI, and optional Qoder ACP while keeping provider-native payloads inside the Bridge. Panerelay does not bundle Claude Code or the Claude Agent SDK.

Most users should install it through `@panerelay/setup`. The Native Host is registered for Chrome-family browsers, Microsoft Edge, and Firefox. Official Chromium builds use Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi`; the Firefox build uses `panerelay@f-loat.dev`. Setup can persist one validated custom identity for each browser family.

Chrome and Edge registrations expose the CDP relay used by agent-browser. Firefox uses a separate managed path: setup installs a user-owned launcher that starts Firefox with Marionette, the Bridge owns loopback geckodriver in connect-existing mode, and agent-browser receives only a participant-scoped virtual WebDriver session. The raw driver endpoint and real session ID remain private. Firefox collaboration stays available after a normal browser start; automation then reports the managed-restart action instead of inventing CDP support.
