## MODIFIED Requirements

### Requirement: Zhihu article publishing is explicit and verified

When live fetch evidence confirms the current endpoint is compatible with RFC-0010, the built-in Zhihu adapter SHALL expose `article-publish` as a guarded write command. The command SHALL distinguish first publication from an update to an already published article, SHALL send only bounded explicitly supplied settings, and SHALL verify the returned article ID, author, public URL, and published state before reporting success. Review, challenge, scheduling, paid-column, contribution, attachment, image upload, and ambiguous asynchronous outcomes SHALL fail closed or remain unsupported. A dynamic signature MAY be implemented only when every signer input is request-known or non-secret and sanitized deterministic fixtures detect drift; a signature requiring unavailable protected browser state SHALL keep that exact flow unsupported.

#### Scenario: Current publication flow lacks bounded live evidence

- **GIVEN** live verification has passed only for private-draft create, read, update, and delete
- **WHEN** Panerelay builds the Zhihu command catalog
- **THEN** the catalog does not expose `article-publish`
- **AND** publication and published-article updates remain documented as Unsupported

#### Scenario: Caller publishes a private draft

- **GIVEN** an owned private draft with a non-empty title and sufficient content
- **WHEN** the caller invokes `article-publish --execute`
- **THEN** the adapter requests first publication and returns the canonical public article URL only after the same article ID and author are readable as published

#### Scenario: Caller publishes changes to an existing article

- **GIVEN** an owned published article has a pending editable draft
- **WHEN** the caller invokes `article-publish --execute`
- **THEN** the adapter requests an article update rather than a second first publication
- **AND** it verifies the same public article identity and current published state after the operation

#### Scenario: Publication outcome is not synchronously verifiable

- **GIVEN** Zhihu accepts an article for review, schedules it, challenges the account, requires unavailable protected signer state, or returns no stable published identity
- **WHEN** the publish request completes or is prepared
- **THEN** the adapter reports a pending or failed outcome without claiming that the article is publicly published

### Requirement: Owned Zhihu comments have guarded mutations

The built-in Zhihu adapter SHALL independently expose each owned-comment mutation only when live fetch evidence confirms that exact endpoint is compatible with RFC-0010. A retained command SHALL require `--execute`, accept only numeric comment IDs or canonical supported comment targets, verify ownership before mutation, and verify the resulting content or absence before reporting success. The adapter SHALL NOT emulate an update by deleting and recreating a comment.

#### Scenario: Caller updates an owned comment

- **GIVEN** a comment is owned by the current signed-in account
- **WHEN** the caller supplies bounded non-empty inline text to `comment-update --execute`
- **THEN** the adapter updates the same comment identity
- **AND** it reads the comment back and verifies the requested content before reporting success

#### Scenario: Caller deletes an owned comment

- **GIVEN** a comment is owned by the current signed-in account
- **WHEN** the caller invokes `comment-delete --execute`
- **THEN** the adapter deletes the comment and verifies that the same comment ID is no longer readable
- **AND** transient 5xx detail reads or delayed deletion visibility use only bounded read-only retries

#### Scenario: Caller targets another author's comment

- **GIVEN** the target comment author does not match the current signed-in account
- **WHEN** the caller invokes a comment mutation
- **THEN** the adapter fails before issuing the mutating request

#### Scenario: Upstream does not support stable comment editing

- **GIVEN** Zhihu exposes no verified same-identity comment update request
- **WHEN** Panerelay builds the Zhihu command catalog
- **THEN** `comment-update` remains omitted and documented as Unsupported
- **AND** Panerelay does not silently replace the comment with a new ID
