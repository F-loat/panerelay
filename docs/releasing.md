# Stable release checklist

Panerelay candidate creation is deliberately separate from publication. The repository commands below build and validate local artifacts only; they do not publish packages, create tags, upload assets, call release APIs, or require publication credentials.

## Prepare the next release

The manual [Prepare Release workflow](../.github/workflows/prepare-release.yml) accepts a semantic version increment and opens a validated version pull request:

- `major`: `X.Y.Z` → `(X+1).0.0`
- `minor` (default): `X.Y.Z` → `X.(Y+1).0`
- `patch`: `X.Y.Z` → `X.Y.(Z+1)`

The Chrome numeric identity appends `.0` to the selected semantic version. Prepare Release never publishes packages, creates a tag or GitHub Release, submits to Chrome Web Store, or pushes directly to the default branch.

1. Confirm the current repository version already has its matching stable tag and GitHub Release.
2. In GitHub Actions, open **Prepare Release**, choose **Run workflow** from the default branch, select `major`, `minor`, or `patch`, and wait for the version pull request.
3. If GitHub marks the Action-created pull-request workflows as awaiting approval, approve them from the pull request, then review its version-only diff and checks.
4. Merge the preparation pull request. Do not run Prepare Release again until that merged version has been published by **Release → stable**.

Prepare Release requires repository **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**. The workflow requests only `contents: write` and `pull-requests: write`; npm trusted-publishing permission remains isolated to the Release workflow.

## Candidate prerequisites

- [ ] Work from the intended release commit with a clean working tree.
- [ ] Confirm `release.config.json`, root/package versions, packed dependencies, Extension `version_name`, and inventory identify the intended plain semantic version.
- [ ] Confirm the four-component Chrome numeric version matches `release.config.json` and sorts after the prior stable Store version.
- [ ] Confirm the retained public manifest key derives official Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi` and no private signing material exists in source or artifacts.
- [ ] Confirm agent-browser 0.33.0 is the minimum and each version in the verified list has a version-specific compatibility record.
- [ ] Confirm Claude Code 2.1.206 is the minimum external CLI version and Panerelay does not package a Claude runtime.
- [ ] Confirm the Bridge packages its ACP SDK runtime, excludes the Claude Agent SDK and Claude platform binaries, and keeps the bounded Claude/Qoder CLI compatibility probes current.
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

- [ ] Confirm `$candidate_directory/inventory.json` records channel `stable`, the intended version and commit, `"dirty": false`, official Chromium and Firefox Extension IDs, minimum agent-browser and Claude Code versions, and the verified agent-browser version list.
- [ ] Confirm the directory contains four `@panerelay` npm tarballs, one Chromium/Edge Extension zip, one Firefox Extension zip, `inventory.json`, and `SHA256SUMS`.
- [ ] Verify checksums from inside the candidate directory:

  ```bash
  (cd "$candidate_directory" && shasum -a 256 -c SHA256SUMS)
  ```

- [ ] Inspect every npm tarball for its intended public files, exact internal dependency pins matching the candidate version, the ACP dependency, no Claude Agent SDK or Claude platform runtime, and absence of tests, workspace ranges, credentials, logs, and signing keys.
- [ ] Inspect both Extension archives for all manifest/HTML-referenced assets, matching versions, official identities, and `panerelay-platform-modules.json`. Confirm each ownership record includes its own background/panel adapters and excludes the other platform's private modules; the Chromium archive retains its public key, while Firefox has no debugger permission.
- [ ] Install all four packed tarballs in one disposable consumer and confirm setup → doctor → update → doctor → uninstall, including persisted custom Chromium and Firefox Extension IDs.

## Runtime acceptance

- [ ] Extract and load the retained Chromium Extension archive in the daily Chrome profile.
- [ ] Run `panerelay doctor`; confirm the Chrome-family and Firefox Native Host manifests, exact configured identities, actual connected browser identity, agent-browser version, Provider config, and optional Claude/Qoder status.
- [ ] With agent-browser 0.33.0, authorize a local fixture tab, run one bounded Provider session, observe visible control, revoke it, and confirm debugger/session cleanup.
- [ ] Run one bounded Codex browser-MCP turn, one external Claude Code CLI browser-MCP turn, and one Qoder ACP browser-MCP turn when each optional runtime is available. Exercise a permission decision, interruption, and browser authorization revocation without retaining prompts or page data.
- [ ] Load the Chromium archive in daily Edge and repeat one bounded authorization, Provider command, revocation, and cleanup flow.
- [ ] Load the Firefox archive in daily Firefox, start it through the installed Panerelay launcher, and record exact Firefox, geckodriver, and patched/released agent-browser versions. Verify current-tab authorization, navigation, snapshot, input, screenshot, revocation, Provider cleanup, and that closing Panerelay's driver leaves Firefox running. Also verify normal Firefox startup keeps chat, projects, and page comments available while automation shows the managed-restart action.
- [ ] On real Windows Chrome, Edge, and Firefox, repeat setup, registry discovery, Host launch, doctor, update, uninstall, and cleanup from paths containing spaces. Confirm only the exact HKCU Panerelay Native Messaging keys and user-owned files change.
- [ ] Remove disposable consumers, browser state, and temporary candidates, retaining only the intentionally accepted `$candidate_directory`.

## Compatibility and distribution boundaries

- Panerelay components remain one lockstep compatibility unit; the protocol does not yet negotiate across versions.
- Panerelay reuses an existing Chrome or Edge process and cannot own isolated contexts, launch-time proxy or profile selection, whole-browser close, or top-level request containment.
- Firefox automation uses WebDriver through a managed launcher and participant-scoped policy relay; it never claims Chromium CDP. CDP-only command groups and an unpatched agent-browser Provider fail closed.
- Activity is sanitized, bounded, memory-only, and not a durable audit history.
- Claude Code and Qoder are optional; their absence must not block Codex or browser automation.
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
- The workflow run exposes `panerelay-extension-<version>`, containing the Chromium/Edge and Firefox Extension zips, `inventory.json`, and `SHA256SUMS`.
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
2. uploads the downloadable Chromium/Edge and Firefox Extension artifacts;
3. publishes the exact tarballs under npm tag `latest`;
4. creates `v<version>` and a GitHub Release for the selected commit; and
5. attaches both Extension zips and their checksums to the Release.

The complete Actions artifact remains the audit and recovery source for `inventory.json` and full candidate checksums. The [Chrome Web Store listing](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) is the default Chrome/Edge installation channel; GitHub Release zips are retained for Firefox, manual, and offline verification.

Afterward:

- [ ] Install again from npm and the downloaded GitHub Release asset.
- [ ] Upload the stable Chromium Extension zip to Chrome Web Store and complete Store review manually.
- [ ] Sign and distribute the matching Firefox Extension through the intended Firefox Add-ons channel; do not claim store availability before review completes.
- [ ] Verify npm provenance and the `latest` tags.
- [ ] Mark an RFC `Implemented` only after released artifacts pass their applicable acceptance evidence.

## Retry and recovery

npm publication is not transactional across four packages. Before any new package is published, the workflow compares existing registry SHA-512 integrity with the candidate. A retry skips only an identical package and publishes the missing packages in dependency order; a different package with the same immutable version fails closed.

If a beta fails, rerun it to produce a new beta version. If stable npm publication succeeds but GitHub Release creation fails before creating a tag or draft, rerun the same workflow: it accepts identical npm tarballs and retries the missing Release. If the failed attempt already created a tag or draft, finish that Release manually from the same commit and accepted assets. If public contents differ, prepare a new patch version rather than overwriting npm packages or reusing a tag.
