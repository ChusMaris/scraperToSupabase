## ADDED Requirements

### Requirement: Keep legacy and live federation imports on separate endpoints
The API SHALL preserve `POST /api/federation/import` as the original federation-import endpoint and SHALL provide `POST /api/federation/live-import` for MatchOnline snapshots. The original endpoint SHALL retain its request and persistence behavior for requests without `liveMatchId` and SHALL reject requests containing `liveMatchId` with an explicit instruction to use the live endpoint. The live endpoint SHALL require a valid numeric `liveMatchId`, validate complete stats and play-by-play payloads, and use that value as the stable source identity for the match.

#### Scenario: First snapshot for a direct match
- **WHEN** `/api/federation/live-import` receives a valid match snapshot with a numeric `liveMatchId`
- **THEN** it persists the match using that ID as the source identity

#### Scenario: Existing client omits the direct-match ID
- **WHEN** an existing federation import client submits a valid request without `liveMatchId` to `/api/federation/import`
- **THEN** the API processes it using the existing request contract and identity fallback

#### Scenario: Direct-match payload is sent to the legacy endpoint
- **WHEN** a request with `liveMatchId` is sent to `/api/federation/import`
- **THEN** the API rejects it and identifies `/api/federation/live-import` as the correct route

#### Scenario: Live endpoint omits the direct-match ID
- **WHEN** `/api/federation/live-import` receives a snapshot without `liveMatchId`
- **THEN** the API rejects it before persistence

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
For live snapshots, the API SHALL link an event to a player using the PBP actor UUID, name, dorsal, and team UUID when those fields are present. It SHALL preserve events without player identity as match movements with no player association, and SHALL retain the original event type ID and code. It SHALL use movement and shot identifiers distinct from the actor UUID, namespace persisted movement and shot UUIDs by stable match identity, and ensure each such UUID appears at most once in a snapshot. It SHALL NOT create placeholder players or zero-valued player statistics when the boxscore contains no named player or numeric statistics.

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
For requests to `/api/federation/live-import`, the API SHALL upsert the match and replace its match-specific statistics, shots, score evolution, and movements within one database transaction. If the replacement fails, the previous successfully persisted match and its associated data SHALL remain intact. Requests to `/api/federation/import` SHALL continue through the existing persistence path and SHALL NOT invoke the live snapshot RPC.

#### Scenario: Successful live snapshot replacement
- **WHEN** a valid repeated snapshot is persisted for an existing `liveMatchId`
- **THEN** one match remains and its associated rows reflect only the newest complete snapshot

#### Scenario: Live snapshot write fails
- **WHEN** any match-specific row in the transactional replacement fails to write
- **THEN** the transaction rolls back and the previously persisted match snapshot remains available

#### Scenario: Existing import client uses the legacy endpoint
- **WHEN** a request without `liveMatchId` is submitted to `/api/federation/import`
- **THEN** the API does not invoke the new live snapshot RPC and retains existing persistence behavior

### Requirement: Preserve federation playing time in integer seconds
The API SHALL persist federation player playing time as integer seconds in `tiempo_jugado`, matching the database column and source field `computed.seconds`. Stats SHALL convert these values for display and aggregation.

#### Scenario: Persist a live player time
- **WHEN** a federation snapshot reports `computed.seconds` as 596 seconds
- **THEN** the API persists `tiempo_jugado` as integer `596` and Stats displays `9:56`

#### Scenario: Persist a legacy federation import time
- **WHEN** a federation import without `liveMatchId` reports player time in seconds
- **THEN** the API persists the integer seconds unchanged in `tiempo_jugado`
