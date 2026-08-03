# Stable release checklist

Panerelay candidate creation is deliberately separate from publication. The repository commands below build and validate local artifacts only; they do not publish packages, create tags, upload assets, call release APIs, or require publication credentials.

## Prepare the next release

The manual [Prepare Release workflow](../.github/workflows/prepare-release.yml) accepts a semantic version increment, opens a version pull request, waits for its checks, automatically squash-merges the validated metadata change, and then dispatches the stable Release workflow:

- `major`: `X.Y.Z` → `(X+1).0.0`
- `minor` (default): `X.Y.Z` → `X.(Y+1).0`
- `patch`: `X.Y.Z` → `X.Y.(Z+1)`

The Chrome numeric identity appends `.0` to the selected semantic version. Prepare Release itself never publishes packages, creates a tag or GitHub Release, submits to Chrome Web Store, or commits directly to the default branch; its only default-branch change is the guarded squash merge of the generated pull request, after which it dispatches the separate Release workflow.

1. Confirm the current repository version already has its matching stable tag and GitHub Release.
2. In GitHub Actions, open **Prepare Release**, choose **Run workflow** from the default branch, and select `major`, `minor`, or `patch`.
3. The workflow creates the version-only pull request, waits for its reported checks, and squash-merges it into the default branch when every check passes. If GitHub asks for approval before checks on the workflow-created pull request can run, approve those workflows; if a check fails, is cancelled, or never starts before the workflow timeout, the workflow fails and leaves the pull request open for inspection or deliberate manual recovery.
4. After the squash merge is visible on the default branch, Prepare Release dispatches **Release** with channel `stable` and the exact squash-merge SHA. Do not run Prepare Release again until that release has completed.

The Prepare Release job itself does not publish packages, create a tag or GitHub Release, submit to the Chrome Web Store, or bypass repository merge protections; it only dispatches the separate Release workflow after the guarded merge. Prepare Release requires repository **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests** and requests `actions: write`, `contents: write`, and `pull-requests: write`. npm trusted-publishing permission remains isolated to the Release workflow. Repository branch protection, required reviews, required checks, merge queues, and conflicts can still reject the automatic merge.

## Candidate prerequisites

- [ ] Work from the intended release commit with a clean working tree.
- [ ] Confirm `release.config.json`, root/package versions, packed dependencies, Extension `version_name`, and inventory identify the intended plain semantic version.
- [ ] Confirm the four-component Chrome numeric version matches `release.config.json` and sorts after the prior stable Store version.
- [ ] Confirm the retained public manifest key derives official Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi` and no private signing material exists in source or artifacts.
- [ ] Confirm agent-browser 0.33.0 is the minimum and each version in the verified list has a version-specific compatibility record.
- [ ] Confirm Browser Use 0.13.7 is the minimum supported version for the explicit Browser Use integration.
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

- [ ] Confirm Windows Node.js 20 and 22 packed-consumer CI passes base setup, each explicit `--agent-browser` / `--browser-use` path, their combined path, doctor, update, and uninstall.

## Retained candidate inspection

Create an ignored local candidate:

```bash
pnpm run release:pack
release_version="$(node -p 'require("./release.config.json").version')"
candidate_directory=".artifacts/panerelay-$release_version"
```

- [ ] Confirm `$candidate_directory/inventory.json` records channel `stable`, the intended version and commit, `"dirty": false`, official Extension ID, minimum agent-browser and Claude Code versions, and the verified agent-browser version list.
- [ ] Confirm the directory contains seven `@panerelay` npm tarballs, one shared Chrome/Edge Extension zip, `inventory.json`, and `SHA256SUMS`.
- [ ] Verify checksums from inside the candidate directory:

  ```bash
  (cd "$candidate_directory" && shasum -a 256 -c SHA256SUMS)
  ```

- [ ] Inspect every npm tarball for its intended public files, exact internal dependency pins matching the candidate version, the ACP dependency, no Claude Agent SDK or Claude platform runtime, and absence of tests, workspace ranges, credentials, logs, and signing keys.
- [ ] Inspect the shared Chrome/Edge Extension archive for all manifest/HTML-referenced assets, versions, public key, and derived official ID; confirm it contains no Firefox manifest, Gecko identity, WebDriver transport, or browser launcher.
- [ ] Install all seven packed tarballs in one disposable consumer and confirm browser administration plus setup → doctor → update → doctor → uninstall, including a persisted custom Extension ID. Exercise base setup, `--agent-browser`, `--browser-use`, and both flags together; diagnose each selected integration with the matching doctor flags.

## Runtime acceptance

- [ ] Extract and load the retained Extension archive in the daily Chrome profile.
- [ ] Run `npx --yes @panerelay/setup doctor` and confirm the Native Host, exact Extension origin, actual registered Extension ID, and optional Agent side-panel status without engine checks. Then rerun it with `--agent-browser`, `--browser-use`, and both to confirm the selected version and registration checks.
- [ ] With agent-browser 0.33.0, authorize a local fixture tab, run one bounded Provider session, observe visible control, revoke it, and confirm debugger/session cleanup.
- [ ] Load the same retained archive in a daily Edge profile, confirm Edge registration and side-panel identity, repeat the bounded fixture flow, and retain the result before changing Edge groups from `Forwarded` to `Verified`.
- [ ] Run one bounded Codex browser-MCP turn, one external Claude Code CLI browser-MCP turn, and one Qoder ACP browser-MCP turn when each optional runtime is available. Exercise a permission decision, interruption, and browser authorization revocation without retaining prompts or page data.
- [ ] On real Windows Chrome and Edge, repeat setup, registry discovery, Host launch, doctor, update, uninstall, and cleanup from paths containing spaces. Confirm only the exact Google Chrome and Microsoft Edge HKCU Panerelay Native Messaging keys and user-owned files change.
- [ ] Remove disposable consumers, browser state, and temporary candidates, retaining only the intentionally accepted `$candidate_directory`.

## Compatibility and distribution boundaries

- Panerelay components remain one lockstep compatibility unit; the protocol does not yet negotiate across versions.
- Panerelay reuses the existing Chrome or Edge process and cannot own isolated contexts, launch-time proxy or profile selection, whole-browser close, or top-level request containment.
- Activity is sanitized, bounded, memory-only, and not a durable audit history.
- Claude Code and Qoder are optional; their absence must not block Codex or browser automation.
- Manual unpacked Extension loading does not use or require a private signing key.

## One-time publication setup

The manual [Release workflow](../.github/workflows/release.yml) publishes through [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), so it does not use a long-lived `NPM_TOKEN`. Every run requires the full `source_sha` commit to release; automatic stable dispatch supplies the squash-merge SHA, while a manual beta run should use the selected source branch's commit SHA.

1. In GitHub repository settings, create an environment named `release`. Add required reviewers when a second human approval gate is desired; otherwise stable publication proceeds automatically after Prepare Release dispatches it.
2. In GitHub repository Actions settings, allow `GITHUB_TOKEN` workflows to create pull requests so Prepare Release can open its version branch for checks and squash merge.
3. In the npm settings for each of `@panerelay/protocol`, `@panerelay/browser-registry`, `@panerelay/cli`, `@panerelay/agent-browser`, `@panerelay/browser-use`, `@panerelay/bridge`, and `@panerelay/setup`, configure the same GitHub Actions trusted publisher:
   - Organization or user: `F-loat`
   - Repository: `panerelay`
   - Workflow filename: `release.yml`
   - Environment: `release`
   - Allowed action: `npm publish`
4. Keep every package `repository.url` aligned exactly with `F-loat/panerelay`. Trusted publishing works while the repository is private, but npm will generate provenance only after the source repository is public.

The workflow grants `id-token: write` only to the protected npm publication job. Candidate preparation uses Node.js 20.19; npm trusted publishing uses Node.js 22.14 and npm 11 or newer without changing the packages' Node.js 20 runtime floor.

## Automated beta publication

From GitHub Actions, open **Release**, choose **Run workflow**, select the source branch and `beta`, and enter that branch's full commit SHA as `source_sha`. Approve the `release` environment if it has an approval rule.

- The workflow derives `<repository-version>-beta.<run-number>` without committing or pushing the temporary version.
- npm receives the seven exact verified tarballs under the `beta` distribution tag.
- The workflow run exposes `panerelay-extension-<version>`, containing the Extension zip, `inventory.json`, and `SHA256SUMS`.
- No Git tag or GitHub Release is created.

Rerunning the same workflow reuses its beta package version and safely resumes only byte-identical packages. A new workflow run advances the beta number. Install the current beta with:

```bash
npx --yes @panerelay/setup@beta
```

That command installs the Native Host and side-panel prerequisites only. Add `--agent-browser`, `--browser-use`, or both when validating the corresponding explicit adapter artifacts.

Do not distribute or load a beta Extension archive until the exact `@panerelay/setup@<ExtensionVersion>` package referenced by that archive is visible from npm. The Extension's bounded install action invokes that exact lockstep version rather than a dist-tag.

Beta Extension archives are developer downloads, not Chrome Web Store updates. Their numeric Chrome versions identify the workflow build but do not define Store upgrade order.

## Automated stable publication

Before running Prepare Release:

- [ ] Complete the candidate and runtime acceptance sections above.
- [ ] Confirm all seven npm packages have the trusted publisher configuration above.

After Prepare Release completes its merge, use these checks for verification or recovery:

- [ ] Confirm the version pull request was squash-merged into the default branch and CI is green.
- [ ] Confirm the repository version is the unused stable version to publish.
- [ ] Confirm the matching remote tag and GitHub Release do not exist.

After the validated preparation merge, Prepare Release dispatches **Release** from the default branch with channel `stable` and the exact squash-merge `source_sha`. Approve the `release` environment only if it has an approval rule. The Release workflow:

1. runs the full workspace check and prepares the verified candidate;
2. uploads the downloadable Extension artifact;
3. publishes the exact tarballs under npm tag `latest`;
4. creates `v<version>` and a GitHub Release for the selected commit; and
5. attaches the Extension zip and its checksum to the Release.

If merge propagation times out or the stable dispatch fails after the merge, do not rerun Prepare Release. Verify that the merged version has no stable tag or GitHub Release, inspect existing Release workflow runs, and manually dispatch **Release** from the default branch with channel `stable` and `source_sha` set to the squash-merge SHA if it has not already started.

The complete Actions artifact remains the audit and recovery source for `inventory.json` and full candidate checksums. The [Chrome Web Store listing](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) is the default end-user installation channel for Chrome and Edge; the GitHub Release zip is retained for manual and offline verification.

The workflow may retain the Extension artifact before npm publication, but that artifact is not ready for distribution until the exact `@panerelay/setup@<ExtensionVersion>` package is published and resolvable. In particular, do not submit the Extension to Chrome Web Store before that npm check passes.

Afterward:

- [ ] Verify npm provenance, the `latest` tags, and exact-version resolution for `@panerelay/setup@<ExtensionVersion>`.
- [ ] Install again from npm and the downloaded GitHub Release asset; exercise both Extension-triggered integration installs.
- [ ] Only then upload the same stable Extension zip to Chrome Web Store and complete Store review manually.
- [ ] Mark an RFC `Implemented` only after released artifacts pass their applicable acceptance evidence.

## Retry and recovery

npm publication is not transactional across seven packages. Before any new package is published, the workflow compares existing registry SHA-512 integrity with the candidate. A retry skips only an identical package and publishes the missing packages in dependency order; a different package with the same immutable version fails closed.

If a beta fails, rerun it to produce a new beta version. If stable npm publication succeeds but GitHub Release creation fails before creating a tag or draft, rerun the same workflow: it accepts identical npm tarballs and retries the missing Release. If the failed attempt already created a tag or draft, finish that Release manually from the same commit and accepted assets. If public contents differ, prepare a new patch version rather than overwriting npm packages or reusing a tag.
