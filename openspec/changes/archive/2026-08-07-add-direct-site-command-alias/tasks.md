## 1. CLI Routing

- [x] 1.1 Add protected installed-site alias resolution before fixed CLI parsing while preserving built-in command, global metadata, unknown-command, raw-URL, and explicit fetch behavior.
- [x] 1.2 Add focused routing tests for direct command/help, language-option positions, built-in collisions, unknown commands, unsafe registries, and exact argument forwarding.

## 2. Help and Examples

- [x] 2.1 Update English and Simplified Chinese global, fetch, site, and command help to present the direct form while retaining the explicit fetch form.
- [x] 2.2 Update built-in Bilibili, site-kit scaffold, root documentation, and relevant test examples to prefer `panerelay <site> <command>`.
- [x] 2.3 Record the additive direct alias separately in browser-fetch compatibility documentation without changing browser or automation-engine classifications.

## 3. Validation and Cleanup

- [x] 3.1 Run focused CLI, site-kit, sites, setup, CLI metadata, and OpenSpec tests plus typechecks.
- [x] 3.2 Rebuild the CLI and verify direct help, direct table/JSON execution, explicit fetch compatibility, and an unknown command against the existing daily Chrome without retaining account or credential output.
- [x] 3.3 Run `pnpm run check`, strict OpenSpec validation, `git diff --check`, and final artifact/secret cleanup.
