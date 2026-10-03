## ADDED Requirements

### Requirement: Extension is available only for the target statistics site
The system SHALL provide a Chrome extension flow for `https://pinetys.github.io/Estad-stiques-/` that extracts the visible player statistics table without changing the existing Federation import flow.

#### Scenario: User opens the extension on the target site
- **WHEN** the active tab is a supported statistics page containing a player table
- **THEN** the extension SHALL offer the complementary-statistics import interface for that page

#### Scenario: User opens the extension on an unsupported page
- **WHEN** the active tab is not a supported statistics page
- **THEN** the extension SHALL explain that the active page is unsupported and SHALL NOT attempt to import data

### Requirement: Statistics table is converted into an editable grid
The system SHALL display the extracted columns `#`, `Jugador`, `T2M`, `T2A`, `T3M`, `T3A`, `TLN`, `TLA`, `REB`, `AST`, `ROB` and `PER`. It SHALL split made/attempted values for T2, T3 and TL and SHALL ignore PJ, Min, PTS(P/P) and VAL(P/P).

#### Scenario: Supported player row is extracted
- **WHEN** the source table contains a player row with recognized values such as `6/16 (38%)` for T2 and an integer for REB
- **THEN** the grid SHALL show the dorsal and player name and map the values to the specified editable columns

#### Scenario: Shooting percentages are present
- **WHEN** a T2, T3 or TL cell contains made, attempted and percentage values
- **THEN** the grid SHALL use only the made and attempted integers and SHALL NOT import the percentage

#### Scenario: Source table or a value cannot be recognized
- **WHEN** the extractor cannot identify a required column or parse a displayed statistic
- **THEN** the extension SHALL identify the extraction problem and SHALL NOT silently submit a partial or guessed value

#### Scenario: User reviews and edits extracted values
- **WHEN** the grid has been populated
- **THEN** the user SHALL be able to edit the dorsal and all imported numeric values before submission, while the player name remains a read-only reference

### Requirement: Aggregated source data represents exactly one selected match
The system SHALL prevent importing aggregate statistics from multiple included matches as if they belonged to one match.

#### Scenario: Exactly one match is included
- **WHEN** the source page reports exactly one included match
- **THEN** the extension SHALL require the user to confirm that it is the same match selected in the import context before submission

#### Scenario: Multiple or zero matches are included
- **WHEN** the source page reports zero or more than one included match
- **THEN** the extension SHALL disable submission and explain that the source must contain exactly one included match

### Requirement: Context selectors show only related catalog values
The system SHALL provide selectors for season, category, competition, matchday, match and team whose available values are constrained by the preceding selections and persisted catalog relationships.

#### Scenario: User selects a season and category
- **WHEN** a season is selected
- **THEN** the category selector SHALL contain only categories with data in that season

#### Scenario: User continues through competition, matchday, match and team
- **WHEN** the user selects a category, competition, matchday and match in sequence
- **THEN** each subsequent selector SHALL contain only values belonging to the selected context, and the team selector SHALL contain only teams participating in the selected match

#### Scenario: User changes an earlier selection
- **WHEN** a selected season, category, competition, matchday or match changes
- **THEN** all dependent selections and options SHALL be cleared or reloaded so stale combinations cannot be submitted

### Requirement: API validates import context and player identity before writing
The system SHALL expose a new API operation for complementary player statistics and SHALL validate the selected match context and every row before performing database writes.

#### Scenario: Import request contains a valid context and rows
- **WHEN** the API receives a valid season/category/competition/matchday/match/team context and non-negative integer values for each imported statistic
- **THEN** the API SHALL resolve every row to exactly one existing player-statistics record using the selected match, team and dorsal

#### Scenario: Dorsal does not uniquely identify a player in context
- **WHEN** a submitted dorsal has no matching player or matches more than one player in the selected match and team
- **THEN** the API SHALL reject the request with a row-specific validation error and SHALL NOT write any rows

#### Scenario: Request contains invalid values or unrelated context
- **WHEN** the request contains a malformed value or a match/team that does not belong to the selected competition and match context
- **THEN** the API SHALL reject the request before any database writes

### Requirement: Import updates only complementary statistics
The system SHALL update only `t2_anotados`, `t2_intentados`, `t3_anotados`, `t3_intentados`, `t1_anotados`, `t1_intentados`, `rebotes_totales`, `asistencias`, `robos` and `perdidas` in existing `estadisticas_jugador_partido` rows.

#### Scenario: Complementary import succeeds
- **WHEN** all submitted rows resolve and pass validation
- **THEN** the API SHALL persist the mapped complementary values and report the number of updated player rows

#### Scenario: Existing row has unrelated statistics
- **WHEN** a complementary import updates an existing player-statistics row
- **THEN** the row's points, minutes, valuation, fouls and all other fields outside the defined mapping SHALL remain unchanged

#### Scenario: Same complementary data is imported again
- **WHEN** a user resubmits the same match/team/player data
- **THEN** the API SHALL update the same existing records without creating duplicate player-statistics rows

### Requirement: Extension captures source data automatically on open
The system SHALL start extracting the active statistics page when the import dashboard opens, without requiring the user to click the extraction action.

#### Scenario: Dashboard opens for a supported source page
- **WHEN** the dashboard is opened from a supported statistics page
- **THEN** the extension SHALL automatically capture and display the table while catalog options load

#### Scenario: Automatic capture fails
- **WHEN** automatic extraction cannot find or parse the table
- **THEN** the dashboard SHALL display the extraction error and SHALL allow the user to retry manually

### Requirement: API base URL comes from a separate configuration file
The system SHALL read the API base URL from a dedicated configuration file rather than embedding it in the dashboard or transport logic.

#### Scenario: API host is changed for deployment
- **WHEN** an operator changes the configured API base URL and allows that host in the extension manifest
- **THEN** the extension SHALL send catalog and import requests to the configured API host

### Requirement: API operations are discoverable through OpenAPI and Swagger UI
The system SHALL serve an OpenAPI document for its HTTP operations and provide an interactive Swagger UI.

#### Scenario: User opens the API documentation
- **WHEN** a user navigates to `/api-docs`
- **THEN** the API SHALL display documentation for health, federation, and complementary statistics operations, including request parameters and authentication requirements

#### Scenario: Client requests the OpenAPI document
- **WHEN** a client requests `/openapi.json`
- **THEN** the API SHALL return a valid OpenAPI 3.0 document describing those operations