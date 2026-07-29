# Alpha release checklist

PaneRelay alpha publication is deliberately separate from candidate creation. The repository
commands described here build and validate local artifacts only; they do not publish packages,
create tags, upload assets, or call GitHub Release APIs.

## Candidate prerequisites

- [ ] Work from the intended release commit with a clean working tree.
- [ ] Confirm `release.config.json`, root/package versions, and the Extension `version_name` match.
- [ ] Keep the Extension numeric version mapping monotonic.
- [ ] Confirm the pinned agent-browser version and every compatibility classification are current.
- [ ] Run:

  ```bash
  pnpm install --frozen-lockfile
  pnpm run check
  pnpm run release:check
  openspec validate --all --strict
  git diff --check
  ```

## Retained candidate inspection

Create an ignored local candidate:

```bash
pnpm run release:pack
```

- [ ] Confirm `.artifacts/panerelay-<version>/inventory.json` records the intended commit and
      `"dirty": false`.
- [ ] Confirm the directory contains four `@panerelay` npm tarballs, one Extension zip,
      `inventory.json`, and `SHA256SUMS`.
- [ ] Verify checksums from inside the candidate directory:

  ```bash
  shasum -a 256 -c SHA256SUMS
  ```

- [ ] Inspect the Extension archive and load its extracted directory in daily Chrome.
- [ ] Install the packed setup candidate with all four local tarballs in one package-manager
      operation.
- [ ] Run `panerelay doctor`, authorize a local fixture tab, complete one agent-browser 0.33.0
      control session, release it, and remove temporary browser state.
- [ ] Confirm setup update and uninstall preserve unrelated agent-browser configuration.

## Known alpha boundaries

- macOS and Linux only; Windows Native Messaging paths are not implemented.
- Manual unpacked Extension loading; no Chrome Web Store signing or update channel.
- Exact PaneRelay component lockstep; no protocol version negotiation.
- Existing daily Chrome profile; no isolated contexts, proxy ownership, or browser launch control.
- Only Codex is implemented in the side panel.
- No durable activity audit history.

## External publication gate

External writes require a separate explicit request after the retained candidate is accepted.
Before publishing:

- [ ] Confirm the working tree is clean and the candidate commit is pushed.
- [ ] Confirm the `@panerelay` npm organization and package access.
- [ ] Publish the four packages with `pnpm publish:alpha --otp=<code>`. The filtered pnpm publish
      runs in dependency order, builds each package through `prepublishOnly`, and uses the `alpha`
      dist-tag.
- [ ] Create one prerelease tag and GitHub prerelease for the same semantic version.
- [ ] Upload the exact Extension archive, inventory, and checksums that were accepted.
- [ ] Install again from the public npm registry and downloaded prerelease asset.
- [ ] Only after the released artifacts pass verification, update the implemented RFC statuses and
      release notes.

If any public smoke step fails, deprecate the affected prerelease package version when appropriate,
leave the release marked as prerelease, and prepare a new alpha version. Do not overwrite existing
npm versions.
