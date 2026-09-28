## ADDED Requirements

### Requirement: Resolve match UUIDs from federation URLs
The system SHALL resolve a match identifier from URLs that use the modern federation pattern, including legacy Mongo IDs and UUID values, and use that identifier to build the real stats and play-by-play endpoints.

#### Scenario: Parse modern federation match URL
- **WHEN** a user submits a URL such as `https://www.basquetcatala.cat/estadistica/partit/{uuid}`
- **THEN** the system extracts the UUID and builds the two federation API URLs for the stats and play-by-play payloads

#### Scenario: Parse legacy match URL
- **WHEN** a user submits a legacy match URL that contains a Mongo ObjectId
- **THEN** the system still extracts the identifier and continues the import flow without failing

### Requirement: Fetch both federation payloads for the same match
The system SHALL retrieve both the stats payload and the play-by-play payload for a match before any persistence step begins.

#### Scenario: Match bundle is complete
- **WHEN** both federation endpoints return valid JSON for the same match
- **THEN** the system creates a single match import bundle containing both payloads

#### Scenario: One payload fails
- **WHEN** one of the two federation endpoints fails or returns invalid JSON
- **THEN** the system stops the import for that match, records the failure, and surfaces a clear error message

### Requirement: Normalize federation payloads into canonical entities
The system SHALL transform the raw federation payloads into canonical entities such as seasons, categories, competitions, groups, clubs, teams, players, rosters, matches, match events, score evolution, and shots before writing to the database.

#### Scenario: Normalize stats header into base entities
- **WHEN** the stats payload includes `header` with category, competition, group, local team, visitor team, and score metadata
- **THEN** the system creates or resolves the corresponding canonical entities in the import model

#### Scenario: Normalize boxscore rows into player and stat records
- **WHEN** the stats payload contains `boxscore` rows with player-level accumulated and computed metrics
- **THEN** the system maps those rows into player and player-stat records in the canonical domain model

#### Scenario: Normalize play-by-play events
- **WHEN** the PBP payload contains `playByPlay` entries with event codes, minute, second, score, actor, and team identifiers
- **THEN** the system creates canonical match event records preserving event UUIDs and team/player relationships

### Requirement: Persist imports idempotently
The system SHALL prevent duplicate imports by using external UUIDs and business keys, while allowing safe re-imports to upsert the same match data without creating duplicates.

#### Scenario: Re-import same match
- **WHEN** the same federation match is imported more than once
- **THEN** the system updates the existing match data using external IDs and unique keys instead of creating duplicate rows

#### Scenario: Duplicate event payload
- **WHEN** a play-by-play event contains a repeated `eventUuid`
- **THEN** the system deduplicates the event and does not create a second record for that same event

### Requirement: Keep the current URL-list import UX intact
The system SHALL preserve the existing import form and multi-URL batch flow while routing each item through the new federation-import-normalization pipeline.

#### Scenario: Batch import with multiple URLs
- **WHEN** a user submits several match URLs in the list
- **THEN** the system processes each item independently, keeps the current job tracking behavior, and reports per-match status

#### Scenario: Per-line matchday override remains supported
- **WHEN** the input line contains `matchday;url`
- **THEN** the system still uses the line-level override while the federation import adapter resolves the match source data
