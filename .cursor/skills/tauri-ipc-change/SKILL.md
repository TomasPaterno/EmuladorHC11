---
name: tauri-ipc-change
description: Diseña y revisa cambios IPC de Tauri entre React TypeScript y Rust, incluidos commands, eventos, DTOs y capabilities. Usar cuando cambia el límite frontend-backend.
---

# Cambiar IPC Tauri

## Procedimiento

1. Definir el caso de uso y el contrato mínimo, con DTOs de entrada, salida y error.
2. Validar en Rust rangos, tamaños, rutas, transiciones de estado y datos no confiables.
3. Implementar el command o evento sin exponer objetos internos del núcleo.
4. Añadir wrapper TypeScript tipado y validar la respuesta en el límite.
5. Conceder solo la capability imprescindible; no ampliar permisos por conveniencia.
6. Revisar cancelación, concurrencia, payload máximo y limpieza de listeners.

## Verificación

- Probar entrada válida, inválida, extrema y llamada fuera de secuencia.
- Confirmar que errores no filtran rutas, dumps ni detalles sensibles.
- Verificar command, registro Tauri, invocación, DTO y capability como un único cambio.
- Ejecutar pruebas Rust y TypeScript pertinentes.

Si el IPC representa comportamiento HC11, incluir el `source_id` que lo sustenta.
