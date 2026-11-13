## Context

La API `POST /api/federation/import` acepta `statsPayload`, `pbpPayload`, metadatos y `sourceUrl`; normaliza el partido y llama a `persistFederationMatchToLegacy`. Esta función hace upsert del partido por `id_match_extern`, pero solo obtiene la identidad de un UUID del payload/URL o de un slug de equipos y fecha. No utiliza el ID numérico de `/directe/<id>`.

El JSON facilitado para el directo contiene `header`, `boxscore` y `playByPlay`. La extensión de Scraper ya captura los endpoints `/matches/stats` y `/matches/pbp`; matchOnline puede reutilizar esa técnica en lugar de enviar su SSE resumido de marcador/jugadores, que no contiene el contrato completo de importación.

En cada importación, el escritor elimina los movimientos, evolución y estadísticas anteriores del mismo partido y guarda los datos recibidos. Repetir snapshots con la misma identidad evita duplicados, pero la limpieza y las inserciones en varias llamadas REST no son atómicas. La actualización debe añadir una ruta transaccional solo para imports con `liveMatchId`, manteniendo sin cambios la ruta actual para clientes existentes.

## Goals / Non-Goals

**Goals:**
- Aceptar un ID numérico de partido directo como identidad de origen explícita y estable.
- Reutilizar la normalización federativa y reemplazar los datos asociados con los del snapshot más reciente.
- Relacionar actores del PBP con jugadores por UUID, nombre y dorsal cuando estén disponibles.
- Mantener eventos de partido sin jugador (por ejemplo, inicio/fin de periodo) con su tipo/código y sin inventar actores o estadísticas.
- Hacer atómica la actualización del partido y sus tablas de datos relacionadas para el nuevo flujo directo.
- Mantener el contrato y comportamiento de persistencia existentes para clientes sin ID de directo.

**Non-Goals:**
- Añadir un endpoint alternativo o cambiar la interfaz de la aplicación Stats.
- Cambiar la autorización existente de la API.
- Implementar el popup, el temporizador o la captura del navegador; corresponden al cambio complementario de matchOnline.

## Decisions

1. **Extender el endpoint existente, de forma opcional y retrocompatible.** Añadir un campo opcional `liveMatchId` al cuerpo de importación. La extensión enviará el snapshot de estadísticas, play-by-play, metadatos y URL de origen como en el contrato actual. La API seguirá aceptando las variantes antiguas `mainJson`/`movesJson`.

2. **Priorizar el ID explícito del directo para la identidad del partido.** El handler pasará `liveMatchId` al escritor; este lo usará como `sourceMatchId` antes de considerar UUIDs existentes o el fallback de equipos/fecha. El ID numérico se convertirá mediante el mecanismo de IDs legacy ya existente y seguirá haciendo upsert por `id_match_extern`.

3. **Conservar y relacionar los eventos de PBP.** El UUID de evento será la identidad del movimiento; el UUID del actor, `actorName`, dorsal y `teamUuid` identificarán jugador/equipo. Para jugadores con UUID y nombre en PBP pero incompletos en boxscore se añadirá roster a partir del actor observado. Eventos sin actor permanecen como movimientos con `jugador_id` nulo. `eventTypeId`/`eventTypeCode` se guardan sin reinterpretarlos como estadísticas si no hay una tabla de códigos verificada. La evolución del marcador se deriva de las transiciones de score del PBP cuando el payload de stats no trae `scoreEvolution`.

4. **No fabricar estadísticas de jugadores ausentes.** No crear jugadores con nombre `Unknown` para elementos del roster que solo contienen UUID. En los snapshots en directo, persistir estadísticas individuales solo cuando el boxscore proporciona valores numéricos; los jugadores identificados a través del PBP siguen vinculados a sus movimientos aunque su boxscore todavía no tenga estadísticas.

5. **Hacer atómica la actualización de datos del partido solo para imports live.** Añadir una RPC SQL con privilegios del invocador que, en una transacción, haga upsert de la fila `partidos` y sustituya sus estadísticas, tiros, movimientos y evolución. Preparar catálogos, equipos, jugadores y plantillas con las operaciones existentes. Imports sin `liveMatchId` mantienen intacto el camino actual. La extensión solo se desplegará tras aplicar la migración.

6. **Validar antes de escribir.** Rechazar ID no numérico, fecha/marcador/equipos inválidos y estructuras incompletas de stats/PBP antes de tocar la base de datos. No convertir campos ausentes en datos ficticios.

## Risks / Trade-offs

- [La RPC requiere desplegar una migración en Supabase antes de habilitar importación móvil] → La función es aditiva, usa privilegios del invocador y la API solo la llama cuando se proporciona `liveMatchId`; mantener sin cambios los clientes existentes y documentar el orden de despliegue.
- [Algunos IDs/códigos de evento no tienen semántica verificada] → Guardar los valores originales, enlazar jugadores solo con identificadores observados y no derivar puntos/faltas de códigos no documentados.
- [Cada importación reemplaza un conjunto completo de filas, por lo que 5 segundos puede generar carga] → Medir la duración con un payload completo; la extensión evita enviar snapshots sin cambios y no solapa escrituras.
- [La forma real de futuras respuestas puede cambiar] → Validar los campos requeridos antes de persistir y mostrar errores explícitos.

## Migration Plan

1. Aplicar la nueva migración SQL/RPC a Supabase; las rutas existentes no la invocan.
2. Desplegar la API con validación y persistencia atómica del campo opcional `liveMatchId`.
3. Distribuir matchOnline para que capture `/matches/stats` y `/matches/pbp` y envíe snapshots completos con el ID directo.
4. Si se revierte, detener la importación móvil; los clientes anteriores continúan usando su ruta actual y los snapshots ya guardados se conservan.

## Open Questions

- Verificar en Firefox Nightly Android, durante la puesta en marcha guiada, que la captura de `/matches/stats` y `/matches/pbp` recibe snapshots nuevos mientras se desarrolla el partido.
