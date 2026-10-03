## Context

La extensión actual del repositorio captura JSON de páginas de Federación y la API `api/server.ts` importa esos bundles completos. La web objetivo, `https://pinetys.github.io/Estad-stiques-/`, presenta un flujo distinto: la fuente es una tabla visible, el usuario debe seleccionar entidades del catálogo de Scraper, revisar una grid y confirmar una actualización parcial en `estadisticas_jugador_partido`.

La tabla de destino ya contiene las estadísticas de partido. Por tanto, la nueva operación debe encontrar al jugador a partir del partido, el equipo y el dorsal, y no crear ni reemplazar datos base del registro. El endpoint actual `/api/federation/options` no sirve como catálogo dependiente porque devuelve listas globales sin relaciones.

## Goals / Non-Goals

**Goals:**
- Permitir extraer y revisar los datos visibles en una grid editable dentro de una extensión Chrome limitada al dominio de Estad-stiques-.
- Guiar la selección mediante opciones encadenadas: temporada, categoría, competición, jornada, partido y equipo.
- Enviar un JSON explícito a un endpoint nuevo de Scraper y actualizar solo los campos complementarios solicitados.
- Evitar asociaciones incorrectas cuando un dorsal no corresponda a un jugador único en el contexto seleccionado.

**Non-Goals:**
- Sustituir o modificar el importador de payloads de Federación.
- Importar PJ, minutos, puntos, jugador, valoración u otros campos marcados N/A.
- Crear jugadores, partidos, plantillas o filas de estadísticas ausentes; este flujo complementa estadísticas existentes.
- Añadir una migración de base de datos salvo que la inspección de esquema durante la implementación demuestre que falta una columna necesaria.

## Decisions

### Extensión independiente y extracción desde DOM

La funcionalidad se añade como un flujo/extensión específico para Estad-stiques-, sin cambiar los content scripts de Federación. Un content script permitido únicamente en el host indicado localizará la tabla de plantilla, leerá sus filas y normalizará los valores T2, T3 y TL a pares de anotados e intentados. La extensión mostrará el jugador como referencia y permitirá editar el dorsal y los campos estadísticos antes de enviar.

La pantalla fuente presenta estadísticas acumuladas sobre los partidos incluidos en sus filtros. Por ello, la extensión solo permitirá continuar cuando pueda confirmar que hay exactamente un partido incluido; antes del envío, el usuario deberá confirmar que ese partido es el mismo que seleccionó en el formulario. No se asignarán acumulados de varios partidos a una fila de un partido individual.

**Alternativa considerada:** capturar datos desde una API interna o variables globales del sitio. Se descarta como contrato inicial porque la fuente confirmada por la solicitud es la tabla visible y no se dispone de un payload estable documentado. La extracción debe fallar con un mensaje útil si no reconoce columnas o filas, nunca enviar una tabla vacía como éxito.

### Catálogos en el backend y filtros relacionados

La API nueva expondrá los catálogos necesarios con identificadores estables y relaciones. Cada selección restringirá la consulta siguiente: temporada limita categorías; temporada y categoría limitan competiciones; la competición limita jornadas y partidos; el partido limita equipos. Las opciones de jugador/plantilla estarán disponibles para validar la asociación del dorsal en el contexto final. La extensión reiniciará las selecciones descendientes cuando cambie una antecesora.

**Alternativa considerada:** descargar listas globales como hace `/api/federation/options` y filtrarlas localmente. Se descarta porque puede mostrar combinaciones inexistentes y requiere más datos innecesarios en el navegador.

### Endpoint nuevo con actualización parcial

Se añadirá un endpoint específico para recibir el contexto seleccionado y una lista de filas editadas. Antes de escribir, validará campos numéricos enteros no negativos, pertenencia del partido a la competición/jornada, pertenencia del equipo al partido y correspondencia unívoca de cada dorsal con un jugador del equipo y partido. Una ausencia o ambigüedad rechazará el lote con detalle por fila y sin escrituras.

La persistencia actualizará únicamente `t2_anotados`, `t2_intentados`, `t3_anotados`, `t3_intentados`, `t1_anotados`, `t1_intentados`, `rebotes_totales`, `asistencias`, `robos` y `perdidas` de la fila ya existente de `estadisticas_jugador_partido`. El dorsal se usa para resolver `jugador_id`; el nombre solo se presenta en la grid y no se persiste desde esta operación. No se usará upsert de la fila completa, para no poner a cero ni sobrescribir estadísticas ajenas a este flujo.

**Alternativa considerada:** reutilizar `/api/federation/import` o el escritor federativo. Se descarta porque ambos importan un modelo de partido distinto y el escritor actual rellena un conjunto más amplio de campos.

### Valores de la grid y mapeo

La captura confirma encabezados como `# JUGADOR`, `PJ`, `MIN`, `PTS (P/P)`, `T2 (M/A %)`, `T3 (M/A %)`, `TL (M/A %)`, `REB`, `AST`, `ROB`, `PER` y `VAL (P/P)`. Cada tiro aparece como `anotados/intentados (porcentaje)`, por ejemplo `6/16 (38%)`; el parser extraerá solo los enteros antes del paréntesis y descartará el porcentaje. El mapeo será: `T2M/T2A` a `t2_anotados/t2_intentados`, `T3M/T3A` a `t3_anotados/t3_intentados`, `TLN/TLA` a `t1_anotados/t1_intentados`, `REB` a `rebotes_totales`, `AST` a `asistencias`, `ROB` a `robos` y `PER` a `perdidas`. Se ignorarán PJ, Min, PTS(P/P) y VAL(P/P). Los nombres visibles de columnas y formatos de porcentaje deben tolerar espacios y marcadores vacíos sin inferir valores silenciosamente.

## Risks / Trade-offs

- [Risk] La estructura o etiquetas DOM del sitio pueden cambiar. → Mitigación: aislar selectores y parseo, validar encabezados y reportar qué columna no se reconoció.
- [Risk] La tabla puede acumular más de un partido incluido. → Mitigación: leer y exigir el contador de partidos incluidos igual a uno y pedir confirmación de coincidencia con el partido seleccionado antes del envío.
- [Risk] El dorsal puede repetirse o no coincidir con la plantilla histórica. → Mitigación: incluir partido y equipo en la resolución, validar unicidad antes de escribir y devolver errores por dorsal.
- [Risk] Una extensión instalada puede acceder a un endpoint de escritura. → Mitigación: limitar permisos de host, validar estrictamente el contrato en el servidor y definir antes de producción el mecanismo de autenticación/autorización compatible con la API existente.
- [Risk] Un error de escritura durante un lote podría dejar actualizadas solo algunas filas si la persistencia no es transaccional. → Mitigación: validar todo el lote antes de la primera escritura, comunicar explícitamente filas actualizadas/fallidas y evaluar una operación SQL transaccional si se exige atomicidad total.

## Migration Plan

1. Añadir el extractor y la interfaz de revisión sin afectar los content scripts federativos.
2. Implementar y probar los endpoints de catálogos relacionados y actualización complementaria en local.
3. Validar con partidos existentes que cada dorsal resuelve la fila esperada y que los campos no incluidos permanecen intactos.
4. Configurar la extensión con el endpoint de API elegido y probar una importación controlada.
5. Si se detecta una asociación o escritura incorrecta, deshabilitar el endpoint o revertir la extensión; los campos originales ajenos al mapeo no deben alterarse.

## Open Questions

- ¿Qué mecanismo de autenticación/autorización debe proteger el nuevo endpoint en producción, dado que la API actual usa la clave anónima de Supabase?
- ¿Cómo representa el sitio una tabla sin partidos incluidos o una estadística sin dato?
- ¿El requisito operativo exige que el lote completo sea transaccional o es aceptable un resultado parcial claramente informado ante fallos de base de datos?