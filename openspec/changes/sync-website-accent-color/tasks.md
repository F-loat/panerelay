## 1. Extension Appearance Channel

- [x] 1.1 Add a deterministic website accent-palette derivation with validation and contrast coverage
- [x] 1.2 Allowlist the production website route in the Extension manifest and add a sender-validated external appearance port
- [x] 1.3 Publish fresh appearance snapshots on connection and stored accent changes, with rejection and cleanup tests

## 2. Website Integration

- [x] 2.1 Add a fail-safe official Extension client that validates palettes, applies website CSS variables, reconnects after disconnect, and cleans up on teardown
- [x] 2.2 Initialize appearance synchronization on every website entry and cover installed, absent, malformed, live-update, reconnect, and cleanup behavior

## 3. Architecture And Compatibility

- [x] 3.1 Amend RFC-0001 with the official-site read-only presentation boundary and its authorization/ownership limitations
- [x] 3.2 Update browser-platform compatibility with Chrome evidence scope, Edge Forwarded status, and unchanged agent-browser 0.33.0 groups

## 4. Verification And Cleanup

- [x] 4.1 Run Extension and website build, typecheck, and automated tests plus strict OpenSpec and diff validation
- [ ] 4.2 After the matching Extension and website artifacts are published, verify initial sync, live accent updates, default fallback, and no site/tab authorization or control acquisition on the production website origin in the daily Chrome profile
- [x] 4.3 Run the full workspace check and remove any machine-specific browser output or generated website locale files from the change
