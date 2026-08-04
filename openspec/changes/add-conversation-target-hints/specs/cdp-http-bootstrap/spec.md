## ADDED Requirements

### Requirement: Bootstrap participants can carry a fail-closed initial target hint

An authenticated CDP bootstrap request MAY contain one bounded opaque target hint for the already selected browser registration. The Bridge SHALL bind that hint to the ticket and participant, SHALL resolve it only against the participant's authorized target set, and SHALL order initial discovery so the exact target is first. A target hint MUST NOT add a target to the exposed inventory, survive its browser generation, or create authorization or control state.

#### Scenario: Bootstrap target is live and authorized

- **GIVEN** an authenticated adapter requests a ticket for a selected browser and an opaque target currently available to that participant
- **WHEN** the compatible client consumes the ticket and performs initial discovery
- **THEN** the participant reports the hinted target first while preserving the rest of its authorized inventory
- **AND** ticket possession and target ordering create no new site permission, tab authorization, attachment, or control lease

#### Scenario: Bootstrap target is unavailable

- **GIVEN** a ticket carries a target hint that is missing, revoked, closed, or outside the selected browser's authorized inventory
- **WHEN** the client consumes the ticket or requests initial target discovery
- **THEN** the Bridge fails the hinted participant explicitly and invalidates its connection material
- **AND** it does not substitute another target or reveal whether an unauthorized target exists

#### Scenario: Authorization is revoked after hinted discovery

- **GIVEN** a hinted participant discovered its exact target
- **WHEN** the user revokes that tab or site authorization
- **THEN** the existing revocation lifecycle removes the target and invalidates affected participant sessions
- **AND** the target hint cannot restore or rediscover it
