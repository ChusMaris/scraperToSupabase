## Why

La importación directa desde el navegador depende de acceder a los JSON del partido en un dominio público, pero la última validación ha demostrado que esa ruta ya no es fiable: el proveedor bloquea o restringe los fetches desde la web y la capa actual no está preparada para los payloads federativos nuevos. El problema ya no es solo el esquema, sino la vía de obtención de los datos: necesitamos una solución que pueda capturar el contenido real desde la página del partido sin depender de accesos públicos abiertos.

Esta propuesta introduce una arquitectura híbrida: la extensión captura los payloads reales desde la página del partido y la API centraliza validación, normalización y persistencia en Supabase usando la capa intermedia ya desarrollada. De ese modo, el flujo pasa a ser seguro, reutilizable y compatible con el modelo canonical que ya hemos definido.

## What Changes

- Introducir una extensión de navegador para capturar los dos JSON federativos del partido desde la propia página de la competición.
- Añadir una API de importación que reciba esos payloads, los valide y los procese con la capa intermedia de normalización.
- Reutilizar la lógica ya implementada de `normalizeFederationMatch` y `upsertFederationMatchToSupabase` para convertir los payloads del proveedor en entidades canónicas.
- Mantener la aplicación actual como flujo legado para importaciones no federativas, pero delegar los casos federativos a la nueva ruta.
- Preparar la API para desplegarse en un entorno hosteado, dejando la extensión únicamente como capturadora en el navegador.
- Asegurar que cada importación sea idempotente y compatible con la base de datos relacional ya diseñada.

**BREAKING**: El flujo de importación pura desde navegador hacia la API pública del proveedor queda obsoleto para el caso federativo; la ruta recomendada pasa a ser extensión + API privada, no fetch directo desde la web.

## Capabilities

### New Capabilities
- `browser-federation-import`: captures the match payload from the browser page, forwards it to an API, and persists the normalized canonical entities into Supabase.

### Modified Capabilities
- `per-url-matchday-override`: no requirement changes; the URL parsing and override flow remains valid and is still used as an input source when the app is acting as the legacy fallback.

## Impact

- `src/services/federationNormalizer.ts`: becomes the canonical middle layer used by the API for all federative payloads.
- `src/services/federationPersistence.ts`: remains the DB write path for the canonical Supabase schema.
- `src/services/importService.ts`: continues to detect federation payloads and route them to the normalized import path when available.
- `server.ts`: remains useful for local dev and proxy fallback, but is no longer the primary production strategy for blocked data sources.
- `extension/`: new Chrome extension project dedicated to reading the match page and forwarding the raw JSON bundle.
- `api/`: new backend service in charge of validation, normalization, and database persistence.
- External dependency: the federative provider data still exists in the browser runtime, but access is captured via the extension instead of direct public fetches.
