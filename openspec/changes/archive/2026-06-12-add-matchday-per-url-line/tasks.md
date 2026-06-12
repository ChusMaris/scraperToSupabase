## 1. Parseo y normalizacion de entrada

- [x] 1.1 Implementar parser por linea que acepte `url` y `matchday;url` en `src/services/importService.ts`.
- [x] 1.2 Aplicar regla de precedencia (jornada por linea sobre jornada global) al construir items de importacion.
- [x] 1.3 Incorporar validaciones por linea (jornada entera positiva, URL no vacia, formato delimitado correcto) con detalle de linea.

## 2. Integracion de contrato y flujo de importacion

- [x] 2.1 Ajustar tipos/payload internos para soportar `matchday` por item sin romper compatibilidad del campo global.
- [x] 2.2 Verificar integracion UI-backend para entradas mixtas (lineas con y sin jornada) manteniendo flujo actual.

## 3. Cobertura de pruebas y regresion

- [x] 3.1 Actualizar/crear tests unitarios en `src/services/__tests__/importService.test.ts` para formato legacy (`url`) y nuevo (`matchday;url`).
- [x] 3.2 Anadir tests de precedencia entre jornada global y jornada por linea.
- [x] 3.3 Anadir tests de lineas invalidas y lineas vacias para validar reportes y comportamiento esperado.

## 4. Documentacion y validacion final

- [x] 4.1 Actualizar texto de ayuda/README para explicar ambos formatos de entrada y la precedencia.
- [x] 4.2 Ejecutar suite de pruebas relacionada y validar que no hay regresiones en importaciones existentes.