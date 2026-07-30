# @panerelay/bridge

PaneRelay's local Native Messaging host and browser-level CDP routing boundary.

The Bridge connects the PaneRelay Extension, agent-browser Provider, and local Agent runtimes over
user-scoped local transports. It binds browser relay services to loopback, enforces the active
control lease, and ships a bundled Native Host executable for installation by `@panerelay/setup`
on macOS, Linux, and Windows. Its internal Agent provider registry supports Codex and optional
Qoder ACP while keeping provider-native payloads inside the Bridge.

Most users should install it through `@panerelay/setup`. Official builds use Extension ID
`panplnkjlkoceaonlmpdekjphgmbggmi`; setup can persist one validated custom ID for self-built or
differently signed Extensions.
