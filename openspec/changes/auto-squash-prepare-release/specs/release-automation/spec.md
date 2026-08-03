## MODIFIED Requirements

### Requirement: Stable version preparation is reviewable

Panerelay SHALL expose a manually triggered Prepare Release workflow that derives the next major, minor, or patch stable version from the currently released repository version, defaults to a minor increment, updates every lockstep package and Extension identity, validates the result, opens a pull request, waits for its reported checks, and squash-merges that pull request into the default branch only after all validation passes. The workflow SHALL NOT publish packages, create a tag or GitHub Release, submit to the Chrome Web Store, or bypass repository merge protections.

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
- **AND** stable publication still requires a later explicit `stable` selection in the Release workflow
- **AND** it does not publish npm packages, create a release tag, create a GitHub Release, or submit to Chrome Web Store

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
