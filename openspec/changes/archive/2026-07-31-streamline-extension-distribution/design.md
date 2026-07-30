## Context

See `proposal.md` for motivation. Candidate preparation writes one complete directory containing four npm tarballs, the Extension zip, `inventory.json`, and a `SHA256SUMS` file covering the distributable tarballs and zip. The Release workflow uploads a smaller Extension-focused Actions artifact, then currently copies all three files from that artifact into the public stable GitHub Release.

The official Chrome Web Store ID and listing are stable distribution identities. The Extension, setup package, Bridge, and Provider remain lockstep compatible, and agent-browser `0.33.0` remains the minimum verified integration baseline.

## Goals / Non-Goals

**Goals:**

- Preserve complete candidate evidence for maintainers and retry recovery.
- Make every public GitHub Release checksum entry independently verifiable from that Release's attached assets.
- Present Store installation as the normal user path without weakening development and rollback instructions.

**Non-Goals:**

- Change candidate generation, npm publication inputs, or immutable package verification.
- Automate Chrome Web Store upload or review.
- Change Extension authorization, tab control, browser ownership, or any capability classification in the compatibility matrix.

## Decisions

### Keep one complete Actions artifact boundary

The workflow will continue uploading the verified Extension zip, `inventory.json`, and the candidate's complete `SHA256SUMS` as the downloadable Actions artifact. Publication and audit tooling can therefore retain the machine-readable inventory and original hashes.

Removing inventory at candidate generation was rejected because npm publication and recovery use it as the source of candidate identity and artifact ordering.

### Derive a public checksum file in the stable Release job

After downloading the verified Extension artifact, the stable Release job will select the exact checksum entry whose filename equals the versioned Extension zip. It will require exactly one match and replace the local `SHA256SUMS` copy before creating the Release. The Release will attach only that zip and filtered checksum file.

Attaching the full candidate checksum file was rejected because it names npm tarballs unavailable from the GitHub Release. Attaching npm tarballs merely to make the checksum list complete was rejected because npm is their canonical distribution channel.

### Put the Store link at the first user installation step

Both root quickstarts and setup package guidance will link the official Store listing before the setup command. After a successful CLI setup, the resolved Extension ID will select the next step: the official ID prints the Store URL, while a custom ID prints matching-build guidance without a Store link. Unpacked instructions remain in development, candidate acceptance, self-built identity, and rollback contexts.

Pinning a Panerelay release number in installation prose was rejected because the Store and npm resolve the current supported release. The existing agent-browser minimum remains version-specific because it is a compatibility constraint rather than release marketing.

## Risks / Trade-offs

- **[A malformed candidate checksum list could publish an unverifiable Release]** → The stable Release job requires exactly one checksum entry matching the exact Extension archive name before invoking the GitHub release command.
- **[Users needing offline installation no longer see it in the first quickstart step]** → GitHub Release archives remain available and development/release documentation retains the unpacked path.
- **[Store review can temporarily lag npm publication]** → Lockstep compatibility guidance remains explicit, and maintainers continue uploading the accepted stable zip to the Store after automated publication.

## Migration Plan

1. Update documentation and release-contract tests.
2. Update the stable Release job while leaving candidate and Actions artifact creation unchanged.
3. Validate OpenSpec, release scripts, documentation contracts, and the full workspace.
4. Roll back by restoring the previous Release asset list and quickstart wording; no runtime or persisted state migration is required.
