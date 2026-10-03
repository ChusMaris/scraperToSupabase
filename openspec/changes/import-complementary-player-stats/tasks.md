## 1. Extensión Chrome

- [x] 1.1 Crear el flujo de extensión separado del importador federativo y limitar su activación al host de Estad-stiques-.
- [x] 1.2 Implementar extracción DOM de encabezados y filas de la pestaña Plantilla, normalizando dorsal, jugador y las columnas de estadísticas admitidas.
- [x] 1.3 Separar T2, T3 y TL en anotados/intentos a partir del formato `M/A (%)`, ignorando el porcentaje y mostrando errores si el formato no se reconoce.
- [x] 1.4 Construir grid editable para dorsal y valores importables, con jugador como referencia de solo lectura.
- [x] 1.5 Leer el contador de partidos incluidos, bloquear cero o múltiples partidos y pedir confirmación de que el único incluido coincide con el partido seleccionado.
- [x] 1.6 Implementar selectores encadenados para temporada, categoría, competición, jornada, partido y equipo; limpiar selecciones descendientes al cambiar contexto.
- [x] 1.7 Enviar el contexto y las filas editadas como JSON al nuevo endpoint, mostrando validación, progreso y resultado por dorsal.
- [x] 1.8 Iniciar automáticamente la captura al abrir el dashboard y conservar una acción para reintentar.
- [x] 1.9 Leer la URL base desde un fichero de configuración dedicado, fuera de los scripts de la extensión.
- [x] 1.10 Mostrar los errores de catálogos y permitir reintentar su carga desde la interfaz.

## 2. API y persistencia

- [x] 2.1 Definir y documentar el contrato JSON para consultas de catálogo relacionadas y envío de estadísticas complementarias.
- [x] 2.2 Añadir endpoint de opciones con filtros relacionales para temporada, categoría, competición, jornada, partido y equipo.
- [x] 2.3 Añadir endpoint de importación con validación del contexto, enteros no negativos y filas antes de iniciar escrituras.
- [x] 2.4 Resolver cada dorsal a un único jugador/registro de estadísticas dentro del partido y equipo seleccionados; devolver error claro para ausencias o ambigüedades.
- [x] 2.5 Actualizar solo los diez campos complementarios especificados sin usar upsert de la fila completa ni crear registros ausentes.
- [x] 2.6 Mantener el mismo modelo de acceso público que el endpoint de importación federativa existente.
- [x] 2.7 Publicar el documento OpenAPI y Swagger UI para las rutas actuales y nuevas.

## 3. Verificación y documentación

- [x] 3.1 Añadir pruebas del extractor para tiros anotados/intentados, ceros, formatos no reconocidos y columnas ausentes.
- [x] 3.2 Añadir pruebas de API para filtros encadenados, contexto inválido, dorsal ausente/ambiguo y valores inválidos sin escrituras.
- [x] 3.3 Añadir prueba de persistencia que demuestre que puntos, minutos y demás columnas ajenas permanecen intactos.
- [x] 3.4 Probar una importación controlada contra un partido existente del fixture y verificar recarga idempotente y conteo de filas actualizadas.
- [x] 3.5 Documentar instalación/desarrollo de la extensión, configuración de API y uso del contrato nuevo.
- [x] 3.6 Documentar las URLs `/api-docs` y `/openapi.json` y probar la respuesta de ambas rutas.