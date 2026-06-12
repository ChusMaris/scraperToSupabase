## ADDED Requirements

### Requirement: Import requests SHALL be accepted through an HTTP API
The system SHALL expose an HTTP endpoint that accepts a list of match URLs together with import metadata and starts the import workflow.

#### Scenario: Import endpoint receives a valid request
- **WHEN** a client sends URLs, season, category, competition, and optional jornada values
- **THEN** the system SHALL start the import workflow and return one result per requested match

#### Scenario: Invalid input is rejected clearly
- **WHEN** the request does not contain any valid URLs
- **THEN** the system SHALL return a 400 response with an explanatory error message

### Requirement: Import API SHALL reuse the same processing flow as the UI
The API SHALL use the same import logic as the current button flow so the behavior stays consistent between the browser UI and external integrations.

#### Scenario: UI and API produce the same outcome for a match
- **WHEN** the same URL and metadata are processed through the UI and the API
- **THEN** both paths SHALL produce the same status and result structure for the match
