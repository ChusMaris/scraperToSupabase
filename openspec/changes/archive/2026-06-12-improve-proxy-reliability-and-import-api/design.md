## Context

El proyecto ya tiene un flujo de scraping en el navegador con varios proxies y un endpoint propio en el servidor para evitar algunos filtros. Sin embargo, el orden de proxies no prioriza la ruta que parece funcionar mejor desde el móvil, y la lógica de importación está duplicada dentro de la UI de React. Eso complica usar el mismo flujo desde una extensión o una herramienta externa.

## Goals / Non-Goals

**Goals:**
- Priorizar allorigins-raw como primera opción en la descarga de datos de partidos.
- Mantener fallbacks claros y diagnósticos para otros proxies.
- Reutilizar la misma lógica de importación desde la UI y desde una API HTTP.
- Exponer una API simple para importar varias URLs con metadatos.

**Non-Goals:**
- No se implementará autenticación ni colas persistentes.
- No se añadirá almacenamiento de trabajos en base de datos.
- No se reemplazará el flujo actual de la UI, solo se hará reutilizable.

## Decisions

- Se moverá allorigins-raw al inicio de la cadena de proxies para que sea la primera opción probada.
- Se encapsulará el flujo completo de importación en un módulo compartido para evitar duplicación entre React y Express.
- El endpoint HTTP utilizará el mismo módulo de importación y devolverá resultados por partido, incluyendo el estado final y cualquier error.
- Se mantendrá el modo de simulación actual para no afectar el comportamiento de la UI cuando no se active producción.

## Risks / Trade-offs

- [Proxies públicos pueden caer o limitar peticiones] → Se mantiene un fallback ordenado y se registran los errores con el nombre del proxy.
- [Las respuestas pueden venir con formato inesperado] → Se validarán JSON/HTML y se devolverán mensajes claros si la respuesta no es válida.
- [El endpoint de API no tendrá autenticación inicial] → Se documentará como un punto de entrada interno y se dejará preparado para añadir seguridad después.

## Migration Plan

- La UI existente seguirá funcionando con el mismo botón, pero usando ahora el módulo compartido.
- El endpoint de API se añadirá de forma incremental y no reemplazará el endpoint actual de data-fetcher.
- En caso de problema, el comportamiento anterior puede recuperarse revertiendo el orden de proxies o dejando el endpoint nuevo deshabilitado.

## Open Questions

- Ninguna bloqueante para esta iteración; el comportamiento de los proxies públicos se evaluará en entorno real.
