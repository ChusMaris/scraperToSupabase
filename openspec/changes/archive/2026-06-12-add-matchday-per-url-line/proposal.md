## Why

Actualmente la importacion permite indicar un numero de jornada global opcional y una lista de URLs, pero no permite asignar jornadas distintas por URL en una misma ejecucion. Esto obliga a repetir importaciones o a corregir manualmente datos cuando se mezclan partidos de varias jornadas.

## What Changes

- Se anade soporte para formato por linea `jornada;url` en el campo de lista de URLs.
- Se mantiene el comportamiento actual: si una linea no incluye jornada, se usa el numero de jornada global (si existe).
- Se define precedencia explicita: la jornada por linea tiene prioridad sobre la jornada global.
- Se valida y parsea entrada mixta (lineas con y sin jornada) en una sola importacion.
- Se ajustan mensajes de validacion para reportar lineas invalidas sin romper compatibilidad con el formato antiguo.

## Capabilities

### New Capabilities
- `per-url-matchday-override`: Permite especificar jornada por URL mediante `jornada;url`, con prioridad sobre la jornada global y compatibilidad con el formato historico.

### Modified Capabilities
- Ninguna.

## Impact

- Afecta la logica de parseo y normalizacion de entradas de importacion en `src/services/importService.ts`.
- Puede requerir ajustes en tipos compartidos en `src/types.ts` y en la integracion entre UI y backend (`src/App.tsx`, `server.ts`) si el payload actual no incluye jornada por item.
- Requiere actualizar pruebas en `src/services/__tests__/importService.test.ts` para cubrir formato mixto, precedencia y casos invalidos.
