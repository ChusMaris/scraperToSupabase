## Context

El flujo actual acepta un numero de jornada global opcional y una lista de URLs (una por linea). Esta estructura funciona para importaciones de una sola jornada, pero no cubre cargas mixtas de diferentes jornadas en una sola ejecucion.

Restricciones tecnicas:
- Debe mantenerse la compatibilidad con entrada historica (linea con solo URL).
- No debe romper el contrato actual para usuarios que siguen usando el campo global de jornada.
- La logica de parseo debe identificar errores de formato por linea de forma trazable.

## Goals / Non-Goals

**Goals:**
- Permitir formato `jornada;url` por linea en el campo de URLs.
- Definir precedencia clara: jornada por linea > jornada global.
- Aceptar entrada mixta en el mismo bloque (lineas con y sin jornada).
- Mantener comportamiento previo cuando no se use `;`.
- Mejorar validaciones para reportar lineas invalidas sin ambiguedad.

**Non-Goals:**
- Cambiar el origen de datos o el mecanismo de scraping.
- Introducir nuevos campos de UI adicionales al input existente.
- Reestructurar el modelo global de competicion, categorias o temporadas.

## Decisions

1. Se adopta parseo dual por linea:
- Si la linea contiene `;`, se interpreta como `matchday;url`.
- Si no contiene `;`, se interpreta como `url` y se aplica jornada global (si existe).
Rationale: permite coexistencia transparente entre formato nuevo y antiguo.

2. Regla de precedencia explicita:
- Cuando existe jornada por linea valida, se utiliza esa jornada para esa URL.
- El campo global actua como valor por defecto para lineas sin jornada especificada.
Rationale: evita comportamiento inesperado en lotes mixtos.

3. Validacion estricta por linea con tolerancia de lote:
- Se ignoran lineas vacias.
- Se marca linea invalida cuando falte URL, la jornada no sea numerica positiva, o exista formato incompleto.
- Se retorna reporte con numero de linea para facilitar correccion.
Rationale: mejorar DX sin romper todo el lote por un error aislado.

4. Contrato interno de item normalizado:
- Cada URL procesada se normaliza a una estructura comun con `url` y `matchday` opcional/definido.
Rationale: simplifica consumo posterior en servicios y pruebas.

Alternativas consideradas:
- Separar en dos campos (lista URLs y lista jornadas): descartado por complejidad y riesgo de desalineacion.
- Forzar formato nuevo y eliminar campo global: descartado por ruptura de compatibilidad.

## Risks / Trade-offs

- [Riesgo] Ambiguedad en lineas con multiples `;` -> Mitigacion: split controlado y validacion de exactamente dos segmentos utiles.
- [Riesgo] Jornadas no enteras o valores fuera de rango esperado -> Mitigacion: validar entero positivo y devolver error por linea.
- [Trade-off] Mayor complejidad de parseo frente a formato unico -> Mitigacion: encapsular en funcion dedicada con tests unitarios exhaustivos.

## Migration Plan

1. Implementar parser compatible en servicio de importacion.
2. Ajustar tipos/payload interno si es necesario para incluir matchday por item.
3. Actualizar pruebas unitarias del parseo y de la construccion de solicitudes.
4. Desplegar sin migraciones de datos (cambio backward compatible).

Rollback:
- Revertir parser al formato previo (solo URL por linea + jornada global) sin afectar datos persistidos.

## Open Questions

- Se debe permitir jornada `0` para casos especiales o se mantiene solo `>= 1`?
- Ante lineas invalidas, se desea comportamiento fail-fast o importacion parcial con reporte?