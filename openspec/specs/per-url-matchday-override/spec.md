# per-url-matchday-override

## Purpose
Define and validate per-line matchday overrides for URL import entries while preserving compatibility with legacy URL-only lines.

## Requirements

### Requirement: Parse per-line matchday format
The system SHALL accept URL list entries in two valid formats: `url` and `matchday;url`.

#### Scenario: Parse legacy URL-only line
- **WHEN** a non-empty line contains only a valid URL
- **THEN** the system parses the line as an import item with that URL and no per-line matchday override

#### Scenario: Parse URL line with per-line matchday
- **WHEN** a non-empty line contains `matchday;url` with a valid positive integer matchday and a valid URL
- **THEN** the system parses the line as an import item with that URL and the provided per-line matchday

### Requirement: Apply matchday precedence consistently
The system SHALL prioritize per-line matchday over global matchday for each parsed line.

#### Scenario: Per-line matchday overrides global matchday
- **WHEN** a line provides `matchday;url` and a global matchday is also provided
- **THEN** the import item uses the line matchday value

#### Scenario: Global matchday applies to legacy line
- **WHEN** a line contains only `url` and a global matchday is provided
- **THEN** the import item uses the global matchday value

#### Scenario: No matchday available
- **WHEN** a line contains only `url` and no global matchday is provided
- **THEN** the import item is created without matchday value

### Requirement: Report invalid line format with line-level detail
The system SHALL validate each non-empty line and report invalid lines with enough detail to identify and correct them.

#### Scenario: Reject non-numeric matchday
- **WHEN** a line contains `matchday;url` and matchday is not a positive integer
- **THEN** the system flags that specific line as invalid with a reason indicating invalid matchday

#### Scenario: Reject missing URL in delimited format
- **WHEN** a line contains `matchday;` or an empty URL segment
- **THEN** the system flags that specific line as invalid with a reason indicating missing URL

#### Scenario: Ignore blank lines
- **WHEN** a line is empty or whitespace-only
- **THEN** the system ignores the line and does not create an import item