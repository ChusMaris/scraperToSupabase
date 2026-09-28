## Context

El proyecto actual incluye un flujo de importación de partidos basado en varias páginas y APIs legacy. La interfaz ya soporta una lista de URLs, metadatos por temporada/categoría/competición y cola de jobs por partido. Sin embargo, la lógica de fetch está acoplada a una estructura antigua y no contempla los nuevos endpoints UUID-based de Optimal Way ni el formato real de `stats` y `pbp`.

El nuevo dominio requiere importar dos archivos por partido:
- payload estadístico con `header`, `boxscore`, `shotChart`, `scoreEvolution`, `visibility`
- payload de eventos con `playByPlay`

La solución debe mantener el formulario y el flujo de job actual, pero reemplazar el adaptador del proveedor por una capa federativa de normalización y mapeo.

## Goals / Non-Goals

**Goals:**
- Resolve match IDs from modern federation URLs and legacy URLs.
- Fetch both new API payloads for the same match.
- Normalize raw payloads into canonical domain entities before persistence.
- Preserve the current batch import UX and matchday override behavior.
- Keep the import path idempotent and safe for repeat runs.

**Non-Goals:**
- Not redesign the entire frontend or replace the SSOT schema.
- Not build a full queue system or persistence of jobs beyond the existing UI workflow.
- Not add authentication or multi-user RBAC in this change.

## Decisions

### Decision: Add an explicit federation adapter layer
We will introduce a dedicated import adapter that owns the mapping from raw federation JSON to the canonical domain model. This sits between the scraper and the persistence layer, instead of combining parsing and DB writes in the UI/service layer.

**Why this approach**
- It isolates schema drift from external providers.
- It keeps the frontend import flow stable while the provider contract changes.
- It makes re-imports, validations, and deduplication easier to reason about.

**Alternatives considered**
- Patch the legacy service in place: rejected because it would keep the same coupling and hide the real source-of-truth problem.
- Write directly from JSON to Supabase: rejected because it mixes validation, normalization, and persistence and is difficult to test or reason about.

### Decision: Use a canonical import bundle per match
Each imported match will be processed as a single bundle:
- `stats` payload
- `pbp` payload
- metadata (
  season, category, competition, group, optional matchday
)

This allows all data for one match to be normalized and persisted atomically from one logical operation.

**Why this approach**
- Data for the match is semantically linked.
- It prevents partial imports when one payload is valid and the other is not.
- It aligns with the real supplier contract and the new schema model.

### Decision: Keep the UI and URL parser contract stable
The existing form and list-based import format remain valid, including `url` and `matchday;url` entries. Only the data-fetching strategy changes.

**Why this approach**
- Minimizes user-facing churn.
- Allows the app to remain familiar while changing the provider endpoint contract behind the scenes.
- Preserves support for the per-url override spec already in the project.

### Decision: Normalize with external UUIDs and unique business keys
Every canonical record will store origin UUID values when available, and import deduplication will use those IDs or stable business keys (team + competition + name, match + local + visitor + date, etc.).

**Why this approach**
- The external provider exposes UUIDs and the new schema expects external identifiers.
- Re-imports become safe and idempotent.

## Risks / Trade-offs

- [Provider JSON shape still changes] → Keep validation and schema guards strict so one field drift does not poison all imports.
- [Partial data imports] → Process one match as a single bundle and fail the whole import if required payload sections are missing.
- [Legacy URLs still in circulation] → Keep support for legacy ID extraction while preferring the UUID-based flow for new federation matches.
- [Duplicate match rows] → Use external UUID + competition/date keys and upsert semantics.

## Migration Plan

1. Keep the current import form and existing batch semantics intact.
2. Replace the fetch logic in the scraper service with the new match bundle strategy.
3. Add the federation adapter and normalizer beneath the existing import process.
4. Keep the DB contract aligned with `new_federation_schema.sql` and the official normalized domain model.
5. Validate with a small batch of real matches using the reported UUID-based URLs.

## Open Questions

- Whether the application should also support a direct `stats`-only or `pbp`-only import mode in the future.
- Whether downstream screens need a separate “import audit” log view beyond the current job log.
- Whether a future version should support a server-side import queue instead of browser-side processing.
