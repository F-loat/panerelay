## MODIFIED Requirements

### Requirement: Stable version preparation is reviewable and dispatches publication

Panerelay SHALL expose a manually triggered Prepare Release workflow that derives the next major, minor, or patch stable version from the currently released repository version, defaults to a minor increment, updates every lockstep package and Extension identity, validates the result, opens a pull request, waits for its reported checks, squash-merges that pull request into the default branch only after all validation passes, captures the exact squash-merge commit, confirms that commit is reachable from the default branch, and dispatches the Release workflow with channel `stable` and the required source SHA. Release SHALL check out that source SHA, verify it is reachable from the repository default branch, and target it for the GitHub Release. Prepare Release SHALL NOT directly publish packages, create a tag or GitHub Release, submit to the Chrome Web Store, or bypass repository merge protections.

#### Scenario: Maintainer selects the release increment

- **GIVEN** the default branch identifies released stable version `X.Y.Z`
- **WHEN** a maintainer runs Prepare Release with increment `major`, `minor`, or `patch`
- **THEN** the proposed semantic version is respectively `(X+1).0.0`, `X.(Y+1).0`, or `X.Y.(Z+1)`
- **AND** every publishable package, release descriptor, Extension package, and Extension `version_name` uses that semantic version
- **AND** the Chrome numeric version appends `.0` to the proposed semantic version

#### Scenario: Maintainer accepts the default increment

- **GIVEN** the default branch identifies released stable version `X.Y.Z`
- **WHEN** a maintainer runs Prepare Release without changing its increment selection
- **THEN** the proposed semantic version is `X.(Y+1).0`

#### Scenario: Current repository version is not released

- **GIVEN** the default branch's current semantic version has no matching stable tag and GitHub Release
- **WHEN** a maintainer runs Prepare Release
- **THEN** preparation fails before changing repository state so repeated preparation cannot advance another version

#### Scenario: Target preparation or package version already exists

- **GIVEN** the target version tag, GitHub Release, preparation branch, pull request, or npm package version already exists
- **WHEN** the workflow attempts to prepare the same version
- **THEN** it reports the existing state and does not create a conflicting commit or pull request

#### Scenario: Validated preparation is squash-merged

- **GIVEN** the derived target version is unused, all local release gates pass, and the generated pull request's reported checks complete successfully
- **WHEN** Prepare Release reaches its merge step
- **THEN** it squash-merges exactly the generated preparation commit into the default branch
- **AND** it removes the temporary preparation branch after the merge
- **AND** it waits until the exact squash-merge commit is reachable from the default branch
- **AND** it dispatches the Release workflow with channel `stable` and that commit as `source_sha`
- **AND** Release checks out and targets that `source_sha`
- **AND** it does not publish npm packages, create a release tag, create a GitHub Release, or submit to Chrome Web Store

#### Scenario: Stable dispatch is rejected or merge propagation times out

- **GIVEN** the pull request was squash-merged but the merged commit is not visible on the default branch before the bounded wait expires, or the workflow dispatch request is rejected
- **WHEN** Prepare Release reaches its post-merge handoff
- **THEN** Prepare Release fails without publishing packages or creating a release tag
- **AND** the merged version remains available for deliberate manual recovery through Release

#### Scenario: Default branch advances after the preparation merge

- **GIVEN** another commit reaches the default branch after the preparation pull request is squash-merged
- **WHEN** Prepare Release dispatches Release
- **THEN** the dispatch still carries the exact preparation squash-merge commit as `source_sha`
- **AND** Release checks out and targets that commit rather than the later branch tip

#### Scenario: Release source validation fails

- **GIVEN** Release cannot check out the required `source_sha`, the checked-out commit differs from it, or the source is not reachable from the default branch
- **WHEN** Release begins candidate preparation
- **THEN** Release fails before publishing packages or creating a GitHub Release

#### Scenario: Pull-request validation fails or does not become available

- **GIVEN** the generated pull request has a failed, cancelled, or timed-out check, or its checks never become available before the preparation job timeout
- **WHEN** Prepare Release reaches the merge gate
- **THEN** the workflow fails without merging the pull request or modifying the default branch
- **AND** the generated pull request remains available for inspection or a deliberate manual recovery

#### Scenario: Preparation commit changes before merge

- **GIVEN** the generated pull request head no longer matches the commit validated and pushed by Prepare Release
- **WHEN** the workflow attempts the merge
- **THEN** the merge fails closed without merging a different commit into the default branch

#### Scenario: Repository merge protections reject the merge

- **GIVEN** branch protection, required reviews, required checks, a merge queue, or a merge conflict prevents a direct squash merge
- **WHEN** Prepare Release attempts the merge
- **THEN** the workflow does not use administrator bypass privileges and leaves the pull request unmerged
