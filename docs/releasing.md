# Stable release checklist

Panerelay candidate creation is deliberately separate from publication. The repository commands below build and validate local artifacts only; they do not publish packages, create tags, upload assets, call release APIs, or require publication credentials.

## Prepare the next minor release

The manual [Prepare Release workflow](../.github/workflows/prepare-release.yml) advances the current released `X.Y.Z` identity to `X.(Y+1).0`, resets the Chrome numeric identity to `X.(Y+1).0.0`, validates the change, and opens a pull request. It never publishes packages, creates a tag or GitHub Release, submits to Chrome Web Store, or pushes directly to the default branch.

1. Confirm the current repository version already has its matching stable tag and GitHub Release.
2. In GitHub Actions, open **Prepare Release**, choose **Run workflow** from the default branch, and wait for the version pull request.
3. If GitHub marks the Action-created pull-request workflows as awaiting approval, approve them from the pull request, then review its version-only diff and checks.
4. Merge the preparation pull request. Do not run Prepare Release again until that merged version has been published by **Release → stable**.

Prepare Release requires repository **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**. The workflow requests only `contents: write` and `pull-requests: write`; npm trusted-publishing permission remains isolated to the Release workflow.

## Candidate prerequisites

- [ ] Work from the intended release commit with a clean working tree.
- [ ] Confirm `release.config.json`, root/package versions, packed dependencies, Extension `version_name`, and inventory identify the intended plain semantic version.
- [ ] Confirm the four-component Chrome numeric version matches `release.config.json` and sorts after the prior stable Store version.
- [ ] Confirm the retained public manifest key derives official Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi` and no private signing material exists in source or artifacts.
- [ ] Confirm agent-browser 0.33.0 is the minimum and each version in the verified list has a version-specific compatibility record.
- [ ] Confirm the Bridge packages its ACP SDK runtime and the bounded Qoder compatibility probe remains current.
- [ ] Run:

  ```bash
  pnpm install --frozen-lockfile
  pnpm run check
  pnpm run release:check
  openspec validate --all --strict
  git diff --check
  ```

- [ ] Confirm Windows Node.js 20 and 22 packed-consumer CI passes setup, doctor, update, and uninstall.

## Retained candidate inspection

Create an ignored local candidate:

```bash
pnpm run release:pack
release_version="$(node -p 'require("./release.config.json").version')"
candidate_directory=".artifacts/panerelay-$release_version"
```

- [ ] Confirm `$candidate_directory/inventory.json` records channel `stable`, the intended version and commit, `"dirty": false`, official Extension ID, minimum agent-browser version, and verified-version list.
- [ ] Confirm the directory contains four `@panerelay` npm tarballs, one Extension zip, `inventory.json`, and `SHA256SUMS`.
- [ ] Verify checksums from inside the candidate directory:

  ```bash
  (cd "$candidate_directory" && shasum -a 256 -c SHA256SUMS)
  ```

- [ ] Inspect every npm tarball for its intended public files, exact internal dependency pins matching the candidate version, ACP dependency, and absence of tests, workspace ranges, credentials, logs, and signing keys.
- [ ] Inspect the Extension archive for all manifest/HTML-referenced assets, versions, public key, and derived official ID.
- [ ] Install all four packed tarballs in one disposable consumer and confirm setup → doctor → update → doctor → uninstall, including a persisted custom Extension ID.

## Runtime acceptance

- [ ] Extract and load the retained Extension archive in the daily Chrome profile.
- [ ] Run `panerelay doctor`; confirm the Native Host, exact Extension origin, actual registered Extension ID, agent-browser version, Provider config, and optional Qoder status.
- [ ] With agent-browser 0.33.0, authorize a local fixture tab, run one bounded Provider session, observe visible control, revoke it, and confirm debugger/session cleanup.
- [ ] Run one bounded Codex browser-MCP turn and one bounded Qoder ACP browser-MCP turn. Exercise a permission decision, interruption, and browser authorization revocation without retaining prompts or page data.
- [ ] On real Windows Chrome, repeat setup, registry discovery, Host launch, doctor, update, uninstall, and cleanup from paths containing spaces. Confirm only the exact HKCU Panerelay Native Messaging key and user-owned files change.
- [ ] Remove disposable consumers, browser state, and temporary candidates, retaining only the intentionally accepted `$candidate_directory`.

## Compatibility and distribution boundaries

- Panerelay components remain one lockstep compatibility unit; the protocol does not yet negotiate across versions.
- Panerelay reuses the existing Chrome process and cannot own isolated contexts, launch-time proxy or profile selection, whole-browser close, or top-level request containment.
- Activity is sanitized, bounded, memory-only, and not a durable audit history.
- Qoder is optional; its absence must not block Codex or browser automation.
- Manual unpacked Extension loading does not use or require a private signing key.

## One-time publication setup

The manual [Release workflow](../.github/workflows/release.yml) publishes through [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), so it does not use a long-lived `NPM_TOKEN`.

1. In GitHub repository settings, create an environment named `release`. Add required reviewers when the repository plan exposes environment protection rules; otherwise the explicit manual dispatch remains the human release gate.
2. In GitHub repository Actions settings, allow `GITHUB_TOKEN` workflows to create pull requests so Prepare Release can open its version branch for review.
3. In the npm settings for each of `@panerelay/protocol`, `@panerelay/agent-browser`, `@panerelay/bridge`, and `@panerelay/setup`, configure the same GitHub Actions trusted publisher:
   - Organization or user: `F-loat`
   - Repository: `panerelay`
   - Workflow filename: `release.yml`
   - Environment: `release`
   - Allowed action: `npm publish`
4. Keep every package `repository.url` aligned exactly with `F-loat/panerelay`. Trusted publishing works while the repository is private, but npm will generate provenance only after the source repository is public.

The workflow grants `id-token: write` only to the protected npm publication job. Candidate preparation uses Node.js 20.19; npm trusted publishing uses Node.js 22.14 and npm 11 or newer without changing the packages' Node.js 20 runtime floor.

## Automated beta publication

From GitHub Actions, open **Release**, choose **Run workflow**, and select the source branch and `beta`. Approve the `release` environment if it has an approval rule.

- The workflow derives `<repository-version>-beta.<run-number>` without committing or pushing the temporary version.
- npm receives the four exact verified tarballs under the `beta` distribution tag.
- The workflow run exposes `panerelay-extension-<version>`, containing the Extension zip, `inventory.json`, and `SHA256SUMS`.
- No Git tag or GitHub Release is created.

Rerunning the same workflow reuses its beta package version and safely resumes only byte-identical packages. A new workflow run advances the beta number. Install the current beta with:

```bash
npx --yes @panerelay/setup@beta
```

Beta Extension archives are developer downloads, not Chrome Web Store updates. Their numeric Chrome versions identify the workflow build but do not define Store upgrade order.

## Automated stable publication

Before dispatching `stable`:

- [ ] Complete the candidate and runtime acceptance sections above.
- [ ] Merge the Prepare Release pull request into the default branch and confirm CI is green.
- [ ] Confirm the repository version is the unused stable version to publish.
- [ ] Confirm the matching remote tag and GitHub Release do not exist.
- [ ] Confirm all four npm packages have the trusted publisher configuration above.

Run **Release** from the default branch with channel `stable`, then approve the `release` environment if it has an approval rule. The workflow:

1. runs the full workspace check and prepares the verified candidate;
2. uploads the downloadable Extension artifact;
3. publishes the exact tarballs under npm tag `latest`;
4. creates `v<version>` and a GitHub Release for the selected commit; and
5. attaches the Extension zip, inventory, and checksums to the Release.

Afterward:

- [ ] Install again from npm and the downloaded GitHub Release asset.
- [ ] Upload the same stable Extension zip to Chrome Web Store and complete Store review manually.
- [ ] Verify npm provenance and the `latest` tags.
- [ ] Mark an RFC `Implemented` only after released artifacts pass their applicable acceptance evidence.

## Retry and recovery

npm publication is not transactional across four packages. Before any new package is published, the workflow compares existing registry SHA-512 integrity with the candidate. A retry skips only an identical package and publishes the missing packages in dependency order; a different package with the same immutable version fails closed.

If a beta fails, rerun it to produce a new beta version. If stable npm publication succeeds but GitHub Release creation fails before creating a tag or draft, rerun the same workflow: it accepts identical npm tarballs and retries the missing Release. If the failed attempt already created a tag or draft, finish that Release manually from the same commit and accepted assets. If public contents differ, prepare a new patch version rather than overwriting npm packages or reusing a tag.
