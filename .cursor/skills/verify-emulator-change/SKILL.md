---
name: verify-emulator-change
description: Verifica cambios del emulador HC11 de extremo a extremo con pruebas, trazabilidad, seguridad IPC y revisión de UI. Usar antes de declarar terminada una modificación.
---

# Verificar cambio del emulador

## Matriz de impacto

Determinar qué capas cambiaron: fuente documental, núcleo CPU, memoria/periféricos, IPC Tauri o UI React.

## Comprobaciones

1. Confirmar que cada comportamiento HC11 tiene `source_id`; si la fuente es PDF, comprobar `visual_review: true`.
2. Ejecutar pruebas focalizadas y luego las suites disponibles afectadas.
3. Para CPU, verificar registros, memoria, PC, SP, CCR, ciclos y determinismo.
4. Para IPC, probar validación, errores, límites, concurrencia y mínimo privilegio.
5. Para UI, probar estados vacío/carga/error, teclado, foco y limpieza de listeners.
6. Revisar el diff para detectar cambios accidentales, fuentes sin respaldo y archivos fuera de alcance.

## Informe

```text
Alcance:
Fuentes (source_id):
Pruebas ejecutadas:
Resultado:
Riesgos o pendientes:
```

No declarar éxito si una comprobación aplicable no se ejecutó; indicar explícitamente la causa.
