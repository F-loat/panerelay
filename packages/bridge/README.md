# @panerelay/bridge

PaneRelay's local Native Messaging host and browser-level CDP routing boundary.

The Bridge connects the PaneRelay Extension, agent-browser Provider, and local Agent runtimes over
user-scoped local transports. It binds browser relay services to loopback, enforces the active
control lease, and ships a bundled Native Host executable for installation by `@panerelay/setup`.

Most users should install it through `@panerelay/setup`.
