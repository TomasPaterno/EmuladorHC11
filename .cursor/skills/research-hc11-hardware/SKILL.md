---
name: research-hc11-hardware
description: Investiga comportamiento, instrucciones, periféricos y temporización del Motorola 68HC11 en manuales y datasheets. Usar ante preguntas o cambios que dependan de documentación de hardware o PDFs.
---

# Investigar hardware HC11

## Procedimiento

1. Formular la pregunta técnica y listar variantes del MCU afectadas.
2. Priorizar la hoja de datos más reciente de la variante dentro del corpus;
   después el manual familiar y las revisiones anteriores. Usar fuentes
   secundarias solo como apoyo.
3. Resolver el `source_id` estable desde `docs/hardware/manifest.yaml`.
4. Localizar página y sección exactas. Si es PDF, renderizar e inspeccionar visualmente la página completa.
5. Contrastar tablas, notas al pie, diagramas y páginas adyacentes.
6. Separar evidencia, inferencia y cuestiones abiertas.

## Registro mínimo

```yaml
source_id: <E5|E31|RM3>
document: <título>
revision: <edición o revisión>
file: <ruta o URL>
pdf_page: <número>
printed_page: <número o null>
section: <sección>
visual_review: true
claim: <afirmación sustentada>
```

No aceptar `visual_review: true` sin haber visto la página renderizada. No extrapolar entre variantes sin evidencia explícita.

## Resultado

Entregar hallazgos con `source_id`, citas precisas, discrepancias, nivel de certeza e impacto esperado en código/pruebas.
