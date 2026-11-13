## Why

Los datos del partido solo están disponibles mientras la URL de directo permanece activa; al finalizar, la federación redirige a la página de estadísticas y se pierde la oportunidad de importar el play-by-play. La API debe aceptar snapshots repetidos del mismo partido usando el identificador de la URL directa, para que una extensión cliente pueda guardar las actualizaciones sin crear duplicados.

## What Changes

- Extender el contrato de `POST /api/federation/import` para recibir el identificador numérico de la URL de directo y los snapshots en el formato de la importación federativa existente.
- Usar ese identificador como identidad estable del partido y reemplazar los movimientos, estadísticas, tiros y evolución con el snapshot más reciente en cada importación repetida.
- Relacionar actores del play-by-play con jugadores mediante el UUID, nombre y dorsal disponibles; conservar como movimientos de partido los eventos sin actor y no inventar estadísticas individuales ausentes.
- Hacer atómica la sustitución de los datos del partido solo para el nuevo flujo directo, sin cambiar la ruta de escritura de los clientes existentes.
- Mantener compatibilidad con los clientes que no envían el nuevo identificador.
- Añadir pruebas que cubran snapshots repetidos, movimientos nuevos e identidad estable.

## Capabilities

### New Capabilities

- `live-match-import-api`: Importación repetida e idempotente de snapshots de un partido directo en la API.

### Modified Capabilities

Ninguna.

## Impact

- Proyecto Scraper: `POST /api/federation/import`, normalización y persistencia de partidos en `src/services/federationLegacyWriter.ts`, además del OpenAPI y las pruebas/documentación de la API.
- Migración aditiva en `supabase/migrations` para agregar una RPC transaccional invocada únicamente por las importaciones con `liveMatchId`; los clientes existentes conservan el código de persistencia actual.
- La API existente ya hace upsert del partido y elimina las estadísticas, movimientos y evolución anteriores antes de persistir la nueva instantánea. La importación en directo debe mantener esa sustitución, pero usar explícitamente el ID numérico estable de la URL para identificar el partido entre refrescos.
- El cambio complementario de la extensión Firefox se especifica en `../matchOnline/openspec/changes/matchonline-live-import`.
- No se prevén cambios en la aplicación Stats ni nuevas tablas; se añade una migración SQL con una RPC transaccional sobre las tablas legacy existentes.
