# @panerelay/bridge

Panerelay's local Native Messaging host, Agent provider runtime, and browser-level CDP routing boundary.

The Bridge connects the Panerelay Extension, agent-browser Provider, and local Agent runtimes over user-scoped local transports. It binds browser relay services to loopback, enforces the active control lease, and ships a bundled Native Host executable for installation by `@panerelay/setup` on macOS, Linux, and Windows. Its internal Agent provider registry supports Codex, a user-installed Claude Code CLI, and optional Qoder ACP while keeping provider-native payloads inside the Bridge. Panerelay does not bundle Claude Code or the Claude Agent SDK.

Most users should install it through `@panerelay/setup`. Official builds use Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi`; setup can persist one validated custom ID for self-built or differently signed Extensions.
