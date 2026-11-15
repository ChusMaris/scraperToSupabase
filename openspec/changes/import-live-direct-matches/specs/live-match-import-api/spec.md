## ADDED Requirements

### Requirement: Import live snapshots using a stable direct-match identity
The federation import API SHALL accept an optional numeric `liveMatchId` with a match snapshot and SHALL use that value as the stable source identity for the match. The API SHALL retain its existing payload fields and identity behavior for requests that do not provide `liveMatchId`.

#### Scenario: First snapshot for a direct match
- **WHEN** the API receives a valid match snapshot with a numeric `liveMatchId`
- **THEN** it persists the match using that ID as the source identity

#### Scenario: Existing client omits the direct-match ID
- **WHEN** an existing federation import client submits a valid request without `liveMatchId`
- **THEN** the API processes it using the existing request contract and identity fallback

#### Scenario: Invalid direct-match ID
- **WHEN** the API receives a non-numeric `liveMatchId`
- **THEN** it rejects the request with a non-success response and an explicit validation error

### Requirement: Replace match data on repeated imports without duplicates
For repeated snapshots with the same `liveMatchId`, the API SHALL update the existing match and replace its match-specific statistics, shots, score evolution, and movements with the latest snapshot. It SHALL NOT create duplicate match or child rows for data repeated across snapshots.

#### Scenario: Reimport an unchanged snapshot
- **WHEN** the API receives the same live match snapshot more than once with the same `liveMatchId`
- **THEN** only one match exists for that ID and its associated data contains no duplicate movements, score evolution, shots, or statistics

#### Scenario: Reimport a snapshot with new movements
- **WHEN** the API receives a later snapshot for an existing `liveMatchId` containing additional movements or updated scores
- **THEN** the same match is retained and its associated data reflects the latest snapshot, including the new movements

#### Scenario: Reject an incomplete snapshot
- **WHEN** a live snapshot lacks fields required by the existing normalizer or persistence layer
- **THEN** the API returns a non-success response describing the missing or invalid data and does not report a successful import

### Requirement: Resolve play-by-play actors without fabricating player data
For live snapshots, the API SHALL link an event to a player using the PBP actor UUID, name, dorsal, and team UUID when those fields are present. It SHALL preserve events without player identity as match movements with no player association, and SHALL retain the original event type ID and code. It SHALL use a movement identifier distinct from the actor UUID, namespace the persisted movement UUID by stable match identity, and ensure each movement UUID appears at most once in a snapshot. It SHALL NOT create placeholder players or zero-valued player statistics when the boxscore contains no named player or numeric statistics.

#### Scenario: Resolve a PBP actor missing from the boxscore
- **WHEN** an event contains a player UUID, actor name, dorsal, and team UUID but the boxscore player has only a UUID
- **THEN** the API creates/uses the named player and links the event to that player and team without inventing individual statistics

#### Scenario: Preserve a period event without an actor
- **WHEN** a PBP event such as `INIPER`/121 or `FINPER`/116 has no actor identity
- **THEN** the API persists it as a match movement with no player ID and retains its event type ID and code

#### Scenario: Use boxscore-provided player statistics
- **WHEN** a named PBP actor has numeric player statistics in the latest boxscore
- **THEN** the API links the actor to that boxscore player and persists the available statistics

#### Scenario: Event has no movement UUID
- **WHEN** a PBP event has an actor UUID but no movement UUID
- **THEN** the API generates a unique movement identity instead of reusing the actor UUID

#### Scenario: Same provider movement UUID appears in two matches
- **WHEN** two live matches contain the same provider movement UUID
- **THEN** the API persists distinct movement UUIDs scoped to each match

### Requirement: Replace a live snapshot atomically
For requests with `liveMatchId`, the API SHALL upsert the match and replace its match-specific statistics, shots, score evolution, and movements within one database transaction. If the replacement fails, the previous successfully persisted match and its associated data SHALL remain intact. Requests without `liveMatchId` SHALL continue through the existing persistence path.

#### Scenario: Successful live snapshot replacement
- **WHEN** a valid repeated snapshot is persisted for an existing `liveMatchId`
- **THEN** one match remains and its associated rows reflect only the newest complete snapshot

#### Scenario: Live snapshot write fails
- **WHEN** any match-specific row in the transactional replacement fails to write
- **THEN** the transaction rolls back and the previously persisted match snapshot remains available

#### Scenario: Existing import client uses legacy path
- **WHEN** a request without `liveMatchId` is imported
- **THEN** the API does not invoke the new live snapshot RPC and retains existing persistence behavior
