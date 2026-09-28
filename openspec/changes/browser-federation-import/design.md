## Context

The current scraper can already normalize Federation data once the payload is available, but the live source is increasingly difficult to access directly from a browser. The new pattern is therefore not "download JSON from the public site in the app"; it is "capture the same JSON already loaded in the active browser session and forward it to a backend that normalizes and persists it."

This design keeps the canonical middle layer as the real source of truth. The extension is a transport and extraction layer, not a data model. The API is the validation and persistence layer, not the UI. That separation is important because the same payload can be re-used later for import automation, testing, or scheduled ingestion without reconnecting to the public site.

## Goals / Non-Goals

**Goals:**
- Capture the stats and play-by-play JSON from the active partido page.
- Reuse the existing federation normalizer and canonical persistence logic.
- Push the normalized data to Supabase via a hosted API.
- Keep the legacy scraper working for non-federation flows.

**Non-Goals:**
- Replacing the canonical relational database design or the existing domain model.
- Building full browser automation or scraping the entire federation site through a headless engine.
- Publishing the extension as the production ingest mechanism; it is only the capture mechanism.

## Decisions

### Decision 1: Keep the normalizer as the domain boundary
The normalizer is the only place that knows how to transform provider payloads into canonical records. The extension never writes to Supabase directly, and the API always validates before saving. This keeps the business logic detached from the browser and from the provider schema.

**Alternative considered:** do the mapping inside the browser extension. Rejected because it would entangle UI/device access with persistence logic and make the browser a second source of truth.

### Decision 2: Put the browser extension in charge of extraction only
The extension reads payloads from the runtime page, captures them as a JSON bundle, and sends them to the API. This avoids CORS and public fetch restrictions while staying close to the real source data.

**Alternative considered:** continue attempting direct fetches from the frontend. Rejected because the provider blocks that route and the issue is structural, not incidental.

### Decision 3: Deploy only the API, not the extension
The API is the service that must exist in production; the extension is a local browser helper. The backend is the only component that should be hosted, while the extension remains user-installed and page-scoped.

**Alternative considered:** deploy the extension to a public marketplace or host the extension code as a web app. Rejected because this would add unnecessary operational complexity and would not solve the actual data import problem.

### Decision 4: Use a single API contract for all Federation imports
Both payloads (stats + play-by-play) are sent as one bundle in a single request. The API validates the shape and calls the same middle layer code used elsewhere in the app. This allows idempotent write behavior and keeps the contract easy to test.

**Alternative considered:** one endpoint per payload. Rejected because it creates fragmented state and duplicates the same validation and persistence logic.

## Risks / Trade-offs

- [Risk] The extension depends on the provider page exposing the JSON in a stable global shape. → Mitigation: support multiple extraction strategies (global window variables, script tags, JSON-LD fallback, and explicit page messages).
- [Risk] The API may receive malformed payloads. → Mitigation: validate required keys (`header`, `boxscore`, `scoreEvolution`, `playByPlay`) before calling the normalizer.
- [Risk] Duplicate imports may occur if the same match is sent twice. → Mitigation: maintain idempotent upserts using canonical keys and external UUIDs.
- [Risk] The browser extension may be blocked by site permissions or changes. → Mitigation: keep the capture layer modular and validate the contract after each site change.

## Migration Plan

1. Keep the current app and scraper working for legacy imports.
2. Add the extension project and the backend API project in the same workspace.
3. Move the import logic into the API service using the existing normalizer and persistence layer.
4. Validate with sample stats + PBP payloads from the browser page and compare the generated canonical records.
5. Deploy only the API to a free or low-cost host and keep the extension as the local capture tool.
6. Roll back by switching the source back to the legacy flow if a provider-side block prevents the extension from seeing the payload.

## Open Questions

- Which production host is chosen for the API when the project is moved out of the local repository?
- Will the extension need custom logic for every federation site variant, or is there a stable payload format shared across match pages?
- Is the backend allowed to accept unauthenticated import requests from a browser extension, or should an API key be required in production?
