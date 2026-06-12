## ADDED Requirements

### Requirement: Match downloads SHALL prefer allorigins-raw first
The system SHALL attempt to download match data using allorigins-raw as the first proxy option before trying the remaining fallback providers.

#### Scenario: First proxy attempt uses allorigins-raw
- **WHEN** a match download is requested
- **THEN** the system SHALL try allorigins-raw first and record that provider in the logs

#### Scenario: Fallback providers are used when allorigins-raw fails
- **WHEN** allorigins-raw returns an error, empty content, or a security challenge
- **THEN** the system SHALL continue with the next proxy provider in the ordered list

### Requirement: Download failures SHALL be diagnosable
The system SHALL include the failed proxy name and the reason for the failure in the logs or returned error details.

#### Scenario: Proxy failure is surfaced clearly
- **WHEN** a proxy fails during a download attempt
- **THEN** the system SHALL expose the provider name and the failure reason to the caller
