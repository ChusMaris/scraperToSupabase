## ADDED Requirements

### Requirement: Browser captures federation match payloads
The system SHALL allow the browser extension to read the stats and play-by-play payloads already present in the active match page and send them to the backend API without relying on public fetch calls from the application.

#### Scenario: Match page exposes the JSON bundle
- **WHEN** a user opens a valid match page that contains the federation stats and play-by-play payloads
- **THEN** the extension SHALL collect both payloads and send them to the API as a single import bundle

#### Scenario: Required payload is missing
- **WHEN** the page does not expose the expected stats or PBP payloads
- **THEN** the extension SHALL report the missing data and stop the import without persisting anything

### Requirement: API validates the federation bundle
The system SHALL accept a federation payload from the extension, validate that it contains the required match data, and reject malformed requests before normalizing them.

#### Scenario: Valid bundle is received
- **WHEN** the API receives a stats payload and a PBP payload with the expected structure
- **THEN** the API SHALL validate the contract and continue to normalization and persistence

#### Scenario: Invalid bundle is received
- **WHEN** the API receives a payload without required match data or an empty body
- **THEN** the API SHALL return a 400-level validation error and SHALL NOT write any records

### Requirement: Normalization creates canonical database entities
The system SHALL normalize the raw federation payloads into the canonical relational model before database writes.

#### Scenario: Match statistics are transformed into canonical records
- **WHEN** the API receives valid stats and PBP payloads
- **THEN** the middle layer SHALL generate the normalized season, competition, teams, players, match, score evolution, events, and shots data

#### Scenario: Repeated imports are processed safely
- **WHEN** the same match is imported more than once
- **THEN** the system SHALL update existing canonical records without creating duplicates

### Requirement: API persists matches to Supabase
The system SHALL write normalized federation match data to the existing Supabase schema so the canonical relational model remains the source of truth for downstream screens.

#### Scenario: Federation import succeeds
- **WHEN** the normalized bundle is valid
- **THEN** the API SHALL upsert the canonical data and return a success response with the imported match metadata

#### Scenario: Database write fails
- **WHEN** Supabase rejects a write request
- **THEN** the API SHALL surface the failure and SHALL NOT report the import as successful
