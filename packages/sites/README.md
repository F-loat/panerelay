# @panerelay/sites

`@panerelay/sites` is Panerelay's lockstep catalog of built-in browser-backed fetch adapters. It is one public package for all built-in sites; users do not install one npm package per site.

`@panerelay/setup` depends on the matching version of this package and installs only the adapters a user explicitly selects:

```bash
npx --yes @panerelay/setup add bilibili
npx --yes @panerelay/setup add --all
```

The package is not a command-line installer. Its public API exposes built-in IDs and their packaged two-file source directories so setup can validate and copy them into protected user storage.

Built-in sites are plain source directories under this package's single TypeScript source root, not nested npm packages or workspaces. Bilibili is laid out directly under `packages/sites/src/bilibili`:

- `index.ts` is the bounded stdin/stdout adapter entrypoint.
- `commands/index.ts` explicitly registers every command.
- Each public command and its typed help metadata live in one matching file under `commands/`.
- `commands/_shared/` contains only logic reused by multiple commands.
- `client.ts` contains the optional Bilibili-specific API client and validation helpers.

The package build derives `dist/adapters/bilibili/panerelay-fetch-adapter.json` from those typed command definitions and bundles `adapter.mjs`; the source tree does not maintain a handwritten manifest. New built-in sites use the same flat directory shape and must update the catalog, aggregate build, artifact tests, and lockstep release inventory.
