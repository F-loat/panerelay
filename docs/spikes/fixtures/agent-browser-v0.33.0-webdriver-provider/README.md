# agent-browser WebDriver Provider fixture

This fixture records the coordinated automation-engine change required by Panerelay's Firefox Provider. It is based on the exact upstream source:

- repository: `vercel-labs/agent-browser`
- tag: `v0.33.0`
- commit: `1ed371f3af472cc0d6cd8fdaea75d1a085ff7534`

The patch keeps legacy CDP Provider results compatible and adds an explicit WebDriver result carrying a scoped HTTP endpoint and an existing opaque session ID. It selects agent-browser's existing WebDriver backend, retains its unsupported-command gates, and runs Provider cleanup on normal close and connection failure. Patched clients also declare `browser.provider.webdriver-existing-session` in each Provider launch request, so Panerelay can reject an unpatched CDP-only client before allocating a Firefox participant while leaving the Chromium `0.33.0` minimum unchanged. When Provider metadata declares `webdriverHeartbeatIntervalMs`, the existing WebDriver client also sends a participant-scoped heartbeat and stops it when the backend is dropped.

## Reproduce

From a clean checkout of the commit above:

```bash
git apply /path/to/agent-browser-v0.33.0-webdriver-provider.patch
cargo fmt --manifest-path cli/Cargo.toml -- --check
cargo test --manifest-path cli/Cargo.toml
git diff --check
```

The patch was validated on 2026-07-31 with Rust stable:

- complete `cli` suite: 1,014 passed, 0 failed, 96 ignored
- doctor integration suite: 2 passed, 0 failed
- focused CDP/WebDriver Provider, backend selection, URL/session validation, heartbeat, unsupported-action, and cleanup tests passed

This fixture is development evidence, not an assertion that an agent-browser release already includes the contract.
