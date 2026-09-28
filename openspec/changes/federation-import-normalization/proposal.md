## Why

El proyecto actual puede importar partidos desde la API legacy, pero los datos nuevos de BasquetCatala y Optimal Way ya no vienen en el mismo formato ni desde la misma URL base. Los nuevos partidos usan UUIDs y se consumen desde endpoints tipo `/matches/{id}/stats` y `/matches/{id}/pbp`, mientras la base lógica actual está acoplada a una estructura antigua y a IDs Mongo legacy. Esta diferencia bloquea la importación de la nueva federación sin una capa de adaptación.

La nueva capa debe convertir los payloads reales (`header`, `boxscore`, `shotChart`, `scoreEvolution`, `playByPlay`) en entidades normalizadas, de forma reutilizable y segura, para que la app final no dependa del formato original del proveedor.

## What Changes

- Añadir una capa de importación para partidos federativos basada en UUID y endpoints nuevos.
- Resolver URLs del tipo `.../estadistica/partit/{uuid}` hasta los endpoints de stats y play-by-play reales.
- Validar y normalizar los payloads antes de persistirlos en la base de datos del nuevo modelo relacional.
- Separar la lógica de scraping, normalización, mapeo y persistencia para evitar acoplar frontend y base de datos a JSONs de terceros.
- Mantener el flujo del formulario actual de importación, pero con un adaptador del proveedor nuevo.
- Dejar preparada la importación idempotente y segura para reimportaciones repetidas en la misma temporada y competición.

**BREAKING**: El flujo actual de fetch por endpoints legacy queda obsoleto y debe ser reemplazado por la nueva capa federativa para los JSONs nuevos.

## Capabilities

### New Capabilities
- `federation-import-normalization`: resolves match UUIDs and normalizes the new stats and play-by-play payloads into the canonical relational model before persistence.

### Modified Capabilities
- `per-url-matchday-override`: no direct change in requirement, but it remains part of the input contract for the federated import flow and shares the same URL list parsing behavior.

## Impact

- `src/services/scraperService.ts`: replace legacy match fetch URLs with the new `/matches/{uuid}/stats` and `/matches/{uuid}/pbp` contract.
- `src/types.ts`: accept both legacy Mongo IDs and modern UUIDs during match extraction.
- `src/services/importService.ts`: keep the existing multi-url import flow while feeding the new normalized import bundle.
- `src/services/supabaseService.ts`: migrate from legacy upsert logic to the normalized import pipeline for the new relational model.
- `new_federation_schema.sql`: acts as the canonical destination schema for the normalized payloads.
- External dependency: Optimal Way stats API for the new `stats` and `pbp` endpoints.
