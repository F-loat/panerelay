# Stable release checklist

PaneRelay candidate creation is deliberately separate from publication. The repository commands
below build and validate local artifacts only; they do not publish packages, create tags, upload
assets, call release APIs, or require publication credentials.

## Candidate prerequisites

- [ ] Work from the intended release commit with a clean working tree.
- [ ] Confirm `release.config.json`, root/package versions, packed dependencies, Extension
      `version_name`, and inventory identify `0.1.0`.
- [ ] Confirm the Chrome numeric version is `0.1.0.2`, which sorts after the alpha candidate.
- [ ] Confirm the retained public manifest key derives official Extension ID
      `panplnkjlkoceaonlmpdekjphgmbggmi` and no private signing material exists in source or
      artifacts.
- [ ] Confirm agent-browser 0.33.0 is the minimum and each version in the verified list has a
      version-specific compatibility record.
- [ ] Confirm the Bridge packages its ACP SDK runtime and the bounded Qoder compatibility probe
      remains current.
- [ ] Run:

  ```bash
  pnpm install --frozen-lockfile
  pnpm run check
  pnpm run release:check
  openspec validate --all --strict
  git diff --check
  ```

- [ ] Confirm Windows Node.js 20 and 22 packed-consumer CI passes setup, doctor, update, and
      uninstall.

## Retained candidate inspection

Create an ignored local candidate:

```bash
pnpm run release:pack
```

- [ ] Confirm `.artifacts/panerelay-0.1.0/inventory.json` records the intended commit,
      `"dirty": false`, official Extension ID, minimum agent-browser version, and verified-version
      list.
- [ ] Confirm the directory contains four `@panerelay` npm tarballs, one Extension zip,
      `inventory.json`, and `SHA256SUMS`.
- [ ] Verify checksums from inside the candidate directory:

  ```bash
  shasum -a 256 -c SHA256SUMS
  ```

- [ ] Inspect every npm tarball for its intended public files, exact internal `0.1.0` dependency
      pins, ACP dependency, and absence of tests, workspace ranges, credentials, logs, and signing
      keys.
- [ ] Inspect the Extension archive for all manifest/HTML-referenced assets, versions, public key,
      and derived official ID.
- [ ] Install all four packed tarballs in one disposable consumer and confirm setup → doctor →
      update → doctor → uninstall, including a persisted custom Extension ID.

## Runtime acceptance

- [ ] Extract and load the retained Extension archive in the daily Chrome profile.
- [ ] Run `panerelay doctor`; confirm the Native Host, exact Extension origin, actual registered
      Extension ID, agent-browser version, Provider config, and optional Qoder status.
- [ ] With agent-browser 0.33.0, authorize a local fixture tab, run one bounded Provider session,
      observe visible control, revoke it, and confirm debugger/session cleanup.
- [ ] Run one bounded Codex browser-MCP turn and one bounded Qoder ACP browser-MCP turn. Exercise a
      permission decision, interruption, and browser authorization revocation without retaining
      prompts or page data.
- [ ] On real Windows Chrome, repeat setup, registry discovery, Host launch, doctor, update,
      uninstall, and cleanup from paths containing spaces. Confirm only the exact HKCU PaneRelay
      Native Messaging key and user-owned files change.
- [ ] Remove disposable consumers, browser state, and temporary candidates, retaining only the
      intentionally accepted `.artifacts/panerelay-0.1.0` directory.

## Compatibility and distribution boundaries

- PaneRelay components remain one lockstep compatibility unit; the protocol does not yet negotiate
  across versions.
- PaneRelay reuses the existing Chrome process and cannot own isolated contexts, launch-time proxy
  or profile selection, whole-browser close, or top-level request containment.
- Activity is sanitized, bounded, memory-only, and not a durable audit history.
- Qoder is optional; its absence must not block Codex or browser automation.
- Manual unpacked Extension loading does not use or require a private signing key.

## External publication gate

External writes require a separate explicit request after the retained candidate is accepted.
Before publishing:

- [ ] Confirm the working tree is clean, the candidate commit is pushed, and the retained
      candidate still matches it byte-for-byte.
- [ ] Confirm the `@panerelay` npm organization and public package access.
- [ ] Publish the four packages with `pnpm run publish -- --otp=<code>`. The filtered command runs
      in dependency order and builds each package through `prepublishOnly`.
- [ ] Create the stable `v0.1.0` tag and GitHub release for the same commit.
- [ ] Upload the exact accepted Extension archive, inventory, and checksums.
- [ ] Install again from the public npm registry and downloaded stable asset.
- [ ] Mark an RFC `Implemented` only after the released artifacts pass their applicable
      acceptance evidence.

If a public smoke step fails, deprecate an affected immutable package version when appropriate,
withdraw the release asset if necessary, and prepare a new patch version. Never overwrite an
existing npm version or reuse a release tag.
