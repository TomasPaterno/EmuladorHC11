# ADR 0004: Política de fuentes de hardware

- Estado: aceptada
- Fecha: 2026-09-11

## Decisión

La autoridad primaria es el PDF oficial aplicable a la variante. Para E-series,
M68HC11E/D Rev. 5 prevalece sobre Rev. 3.1. El M68HC11RM/AD Rev. 3 explica
comportamiento familiar y sirve de base para A8, pero declara que complementa y
no reemplaza la hoja de datos.

Toda entrada estructurada contiene documento/revisión (`source_id`), sección,
página impresa, página PDF y estado de revisión humana. `null` significa
"todavía no verificado", nunca "no aplica". OCR, texto extraído, buscadores y
fuentes secundarias sólo localizan evidencia.

## Reglas

- Verificar visualmente bits, direcciones, ciclos, fórmulas y tablas en el PDF.
- Registrar conflictos en `docs/hardware/discrepancies.md`.
- No resolver un conflicto por intuición ni mezclar variantes.
- Un PDF cambiado recibe nueva identidad documental y obliga a revisar citas.
- No publicar hashes, fechas o metadatos calculados si no fueron verificados.

## Consecuencias

Los datos incompletos permanecen explícitamente pendientes y no deben generar
código. La trazabilidad tiene prioridad sobre completar una tabla por inferencia.
