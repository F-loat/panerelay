# Spike 0005: Windows Native Messaging implementation reference

## Status

Implementation reference recorded on 2026-07-30. Real Windows Chrome acceptance remains required.

## Reference

Mearl commit `6f83389` demonstrates the platform shapes Panerelay needs:

- `packages/native-host/src/install.ts` writes a quoted `.cmd` launcher, points the Native
  Messaging manifest at it, and registers the manifest through a current-user Chrome registry key.
- `packages/setup/src/nativeHost.ts` removes managed manifests and launchers and treats a missing
  registry key as an already-clean state.
- `packages/setup/src/process.ts` checks Windows command files with `F_OK`, discovers `.cmd`, `.exe`,
  and bare candidates, and runs command wrappers through `ComSpec` with `/d /s /c`.

The reusable Chrome discovery rule is:

```text
HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\<host-name>
  (Default, REG_SZ) = <absolute manifest path>
```

Registry mutation uses an executable plus an argument array, not an interpolated shell command.

## Panerelay-specific adaptation

Panerelay will retain the implementation shape but use its own ownership and trust boundaries:

| Concern            | Panerelay decision                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User data          | Host bundle, launcher, manifest, runtime config, and agent-browser config live below one Panerelay-owned per-user data root rather than a shared or system-wide Chrome directory. |
| Launcher           | `panerelay-native-host.cmd` quotes the exact current Node executable and installed Host bundle; the manifest and agent-browser Provider both reference this launchable path.      |
| Registry           | Setup adds only `HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\org.panerelay.bridge`; uninstall deletes only that exact key.                                                   |
| Extension identity | The manifest contains one effective validated Extension origin, which may be the official ID or a user override.                                                                  |
| Update             | Setup replaces only Panerelay-managed files and the exact registry value while preserving a persisted custom Extension ID unless explicitly overridden.                           |
| Cleanup            | Repeated or partial uninstall succeeds when files or the exact registry key are already absent and never enumerates or deletes unrelated Native Messaging hosts.                  |
| Diagnosis          | Doctor checks the registry value, manifest, launcher, runtime config, effective Extension origin, Provider config, and live Bridge state for agreement.                           |
| Product scope      | Panerelay has one Native Host and one scoped agent-browser Provider. Mearl-specific multi-mode hosts, cloud services, UI behavior, and system-data layout are not copied.         |

## Risks to verify on Windows

- paths containing spaces, `&`, parentheses, or other command metacharacters;
- npm-generated `.cmd` wrappers for Codex, Qoder, and agent-browser;
- stale or quoted registry values;
- replacement of managed artifacts during update;
- partial uninstall with missing files or registry keys;
- Chrome launching the registered Host in a real user profile.

Unit and packed-consumer tests can establish command construction and ownership behavior. They
cannot replace the required real Windows Chrome launch evidence.
