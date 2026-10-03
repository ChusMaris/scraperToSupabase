## Why

La web de Estad-stiques- muestra estadísticas de tiro y rendimiento individual que faltan o necesitan completarse en `estadisticas_jugador_partido`. Se necesita un flujo revisable que permita extraerlas desde el navegador, corregirlas antes de guardar y asociarlas de forma segura al jugador del partido.

## What Changes

- Añadir una extensión Chrome para `https://pinetys.github.io/Estad-stiques-/` que lea la tabla visible del partido y muestre una grid editable.
- Añadir selectores dependientes para temporada, categoría, competición, jornada, partido y equipo, alimentados por los datos existentes.
- Enviar desde la extensión un JSON con el contexto seleccionado y las filas editadas a un método nuevo de la API Scraper.
- Validar en la API el contexto, el formato y la correspondencia de cada dorsal con un único jugador del equipo en el partido; rechazar ambigüedades sin escribir datos.
- Actualizar exclusivamente estadísticas complementarias existentes: T2 anotados/intentados, T3 anotados/intentados, T1 anotados/intentados, rebotes totales, asistencias, robos y pérdidas. No reemplazar el resto de estadísticas ni crear tablas nuevas.

## Capabilities

### New Capabilities
- `complementary-player-stats-import`: captura, revisión, selección de contexto e importación segura de estadísticas complementarias por jugador y partido.

### Modified Capabilities

## Impact

- `extension/`: nueva experiencia de captura para la web de Estad-stiques-, grid editable y configuración del endpoint.
- `api/server.ts`: nuevo endpoint de opciones relacionadas y nuevo método de importación complementaria.
- Persistencia Supabase en `estadisticas_jugador_partido`; no se prevé migración de esquema.
- Pruebas y documentación de la extensión y del contrato JSON/API.