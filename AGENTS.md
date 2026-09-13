# Contexto IA del proyecto

Este repositorio implementa un emulador Motorola 68HC11 con núcleo Rust, shell Tauri y UI React/TypeScript.

## Autoridad y alcance

- Seguir las reglas de `.cursor/rules/` y cargar la skill project-local adecuada antes de investigar o cambiar código.
- Mantener el núcleo de CPU determinista, independiente de Tauri y de la UI.
- Tratar manuales y datasheets como fuentes primarias; una afirmación de hardware no es válida sin `source_id`.
- Para fuentes PDF, verificar visualmente cada página citada. La extracción de texto por sí sola no constituye evidencia.
- No inventar opcodes, ciclos, flags, mapas de memoria, registros ni comportamiento eléctrico.

## Flujo obligatorio

1. Delimitar el cambio y localizar las fuentes.
2. Registrar `source_id`, documento, revisión, página/sección y `visual_review: true` para evidencia PDF.
3. Implementar en la capa correspondiente sin romper límites arquitectónicos.
4. Probar comportamiento nominal, bordes y regresiones; para instrucciones, cubrir PC, ciclos, registros, memoria y CCR.
5. Actualizar únicamente la documentación afectada y conservar trazabilidad fuente → decisión → código/prueba.

## Skills del proyecto

- `research-hc11-hardware`: investigación de manuales, datasheets y PDFs.
- `implement-hc11-instruction`: implementación o corrección de instrucciones HC11.
- `tauri-ipc-change`: cambios de commands, eventos, DTOs, capabilities o límites IPC.
- `verify-emulator-change`: verificación final del emulador.

## Comprobación

```text
npm ci
npm run check
```

`docs:validate` forma parte de `check` y verifica hashes, `source_id` y
vectores del corpus. El OCR de RM3 es opcional y no es evidencia.

## Restricciones

- Aplicar mínimo privilegio en Tauri; validar en Rust toda entrada no confiable.
- TypeScript estricto, componentes accesibles y estado de emulación fuera de la presentación.
- No modificar planes, scripts, CI, configuración, dependencias ni documentación de hardware salvo petición explícita.
- No considerar terminada una tarea con pruebas o trazabilidad pendientes.
