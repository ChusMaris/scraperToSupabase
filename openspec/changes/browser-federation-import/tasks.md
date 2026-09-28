## 1. Architecture and contract

- [ ] 1.1 Define the exchange contract between extension and API for stats + PBP payloads
- [ ] 1.2 Confirm the canonical import path uses the existing normalizer and persistence layer
- [ ] 1.3 Lock the legacy fallback path for all non-federation imports

## 2. Browser extension

- [ ] 2.1 Scaffold the Chrome extension project in the workspace
- [ ] 2.2 Implement page capture logic for the federation JSON bundle
- [ ] 2.3 Implement a background sender for POST requests to the API endpoint
- [ ] 2.4 Add local logging and failure handling for blocked or missing payloads

## 3. API service

- [ ] 3.1 Scaffold the backend API project and environment configuration
- [ ] 3.2 Add health endpoint and import endpoint for federation payloads
- [ ] 3.3 Validate the incoming contract before invoking the normalizer
- [ ] 3.4 Reuse the canonical middle layer to normalize match data
- [ ] 3.5 Persist the normalized records into Supabase using idempotent upserts

## 4. Validation and deployment

- [ ] 4.1 Test the import contract against sample stats + PBP payloads
- [ ] 4.2 Verify the database writes and duplicates are handled safely
- [ ] 4.3 Prepare deployment instructions for hosting only the API
- [ ] 4.4 Document how the extension and API are used together in production
