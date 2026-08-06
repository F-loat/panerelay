# Spike 0006: Native Host stable launcher and version-pointer reference

- Status: Complete
- Date: 2026-08-05
- OpenSpec: `openspec/changes/add-native-host-self-update`
- RFC: `docs/rfcs/0008-native-host-release-negotiation-and-self-update.md`

## Question

Can one stable Node launcher preserve Native Messaging stdio, select a Host bundle through an atomic semantic-version pointer, leave already running browser Host processes on their original bundle, and select the committed bundle for later Chrome and Edge launches when the managed path contains spaces?

This spike is deliberately a source-backed process probe, not real Windows Chrome/Edge acceptance. It reduces uncertainty around the launcher/pointer boundary while leaving Windows `.cmd`, HKCU, browser startup, and filesystem-permission evidence classified as Partial.

## Fixture

The committed fixture contains:

- `fixtures/native-host-stable-launcher/launcher.cjs`, a path-closed launcher that validates one stable or beta release, rejects symlinks, derives the versioned bundle beneath the managed hosts directory, and inherits stdio;
- `fixtures/native-host-stable-launcher/native-host.cjs`, a bounded Native Messaging framing echo Host whose version comes from its immutable directory; and
- `run-native-host-stable-launcher.mjs`, which creates a disposable path containing spaces, launches independent Chrome- and Edge-labeled processes, switches the pointer, and reconnects both actors.

Run it with:

```bash
node docs/spikes/run-native-host-stable-launcher.mjs
```

The probe creates and removes all mutable state beneath an operating-system temporary directory. It retains no screenshots, browser logs, credentials, prompts, page content, registry state, or machine-specific paths.

## Result

The probe verifies deterministically that:

1. Chrome- and Edge-labeled processes both exchange framed Native Messaging requests and responses through the stable launcher.
2. A launcher path and managed root containing spaces do not alter Node argument boundaries.
3. Processes launched at `0.7.0` continue serving `0.7.0` after the protected pointer is atomically changed to `0.8.0-beta.42`.
4. Later processes launched through the same stable path select `0.8.0-beta.42`.
5. The pointer supplies only a validated release; it never supplies an executable path or command.
6. The disposable managed tree is removed after success or failure.

## Compatibility conclusion

- **Verified by fixture**: Node stdio inheritance, Native Messaging framing, semantic pointer selection, path-with-spaces argument preservation, immutable running-bundle behavior, and reconnect selection.
- **Partial**: Windows `.cmd` invocation, real Chrome/Edge Native Messaging launch, HKCU registration agreement, concurrent live update locking, and Windows protected-file behavior.
- **Unchanged**: agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, Playwright CLI 0.1.17, CDP command groups, authorization, control leases, and browser-process ownership limitations.

The result supports RFC-0008's stable launcher plus atomic version-pointer design. Real Windows Chrome and Edge acceptance remains an explicit release task and is not inferred from this fixture.
