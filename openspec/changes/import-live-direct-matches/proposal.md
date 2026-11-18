## Why

Los datos del partido solo están disponibles mientras la URL de directo permanece activa; al finalizar, la federación redirige a la página de estadísticas y se pierde la oportunidad de importar el play-by-play. La API debe aceptar snapshots repetidos del mismo partido usando el identificador de la URL directa, para que una extensión cliente pueda guardar las actualizaciones sin crear duplicados.

## What Changes

- Añadir `POST /api/federation/live-import` para recibir el identificador numérico de la URL de directo y snapshots en el formato federativo.
- Mantener `POST /api/federation/import` como ruta original, sin alterar su contrato ni comportamiento; rechazar allí payloads con `liveMatchId` para evitar mezclar ambos flujos.
- Usar ese identificador como identidad estable del partido y reemplazar los movimientos, estadísticas, tiros y evolución con el snapshot más reciente en cada importación repetida.
- Relacionar actores del play-by-play con jugadores mediante el UUID, nombre y dorsal disponibles; conservar como movimientos de partido los eventos sin actor y no inventar estadísticas individuales ausentes.
- Hacer atómica la sustitución de los datos del partido solo para el nuevo flujo directo, sin cambiar la ruta de escritura de los clientes existentes.
- Mantener compatibilidad con los clientes originales que usan `/api/federation/import` sin `liveMatchId`.
- Añadir pruebas que cubran snapshots repetidos, movimientos nuevos e identidad estable.

## Capabilities

### New Capabilities

- `live-match-import-api`: Importación repetida e idempotente de snapshots de un partido directo en la API.

### Modified Capabilities

Ninguna.

## Impact

- Proyecto Scraper: nueva ruta `POST /api/federation/live-import`; la extensión de Scraper conserva `POST /api/federation/import`. Ambos reutilizan la normalización, pero solo el endpoint live acepta `liveMatchId` y usa la persistencia transaccional.
- Proyecto matchOnline: cambiar el envío de snapshots al endpoint dedicado `/api/federation/live-import`.
- Migración aditiva en `supabase/migrations` para agregar una RPC transaccional invocada únicamente por las importaciones con `liveMatchId`; los clientes existentes conservan el código de persistencia actual.
- La API existente ya hace upsert del partido y elimina las estadísticas, movimientos y evolución anteriores antes de persistir la nueva instantánea. El endpoint live debe mantener esa sustitución, pero usar explícitamente el ID numérico estable de la URL para identificar el partido entre refrescos.
- El cambio complementario de la extensión Firefox se especifica en `../matchOnline/openspec/changes/matchonline-live-import`.
- No se prevén cambios en la aplicación Stats ni nuevas tablas; se añade una migración SQL con una RPC transaccional sobre las tablas legacy existentes.
