# @panerelay/browser-registry

Protected local discovery and deterministic selection for the independent browser relays registered by Panerelay.

This package stores one user-only registration per connected browser, keeps a separate user-level default, and resolves exactly one browser for each new Provider session. Selection never grants browser permissions or moves a live session between browsers.

It is an engine-neutral shared runtime dependency for Panerelay integrations,
including the Bridge, automation adapters, setup diagnostics, and
`@panerelay/cli`. Users should administer registrations through the Extension
or CLI instead of depending on this library directly.
