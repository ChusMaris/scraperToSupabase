## Why

Las descargas de partidos fallan de forma inconsistente desde el portátil corporativo, mientras que la ruta usando allorigins-raw funciona bien desde el móvil. La solución necesita hacer esa vía la primera opción de forma explícita y además exponer un endpoint reutilizable para importar partidos desde una extensión o desde otras herramientas.

## What Changes

- Reordenar la estrategia de proxies para que allorigins-raw sea la primera opción y dejar el resto como fallback.
- Añadir diagnósticos más claros cuando un proxy falla para poder identificar si el problema es de red, bloqueo o formato de respuesta.
- Extraer el flujo de importación de partidos a una capa compartida que pueda usarse tanto desde la UI como desde una API HTTP.
- Implementar una API para iniciar importaciones de partidos con URLs, metadatos y modo de producción configurable.

## Capabilities

### New Capabilities
- `reliable-match-downloads`: Prioriza y valida la descarga de estadísticas y movimientos con una cadena de proxies más robusta.
- `import-matches-api`: Expone una API para importar partidos de forma programática y recibir el resultado de cada partido.

### Modified Capabilities
- None.

## Impact

- Se tocarán los servicios de scraping y la aplicación React actual.
- Se añadirá un endpoint HTTP en el servidor Express para importar partidos.
- La solución será compatible con el flujo actual del botón de importación sin romper el modo de simulación.
