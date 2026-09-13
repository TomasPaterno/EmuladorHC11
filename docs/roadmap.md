# Roadmap

## Fase 0 — Fundación

Estado: **cerrada**.

- Scaffold Tauri v2 + React/TypeScript compilable.
- Corpus oficial identificado, política de fuentes y YAML revisable.
- Límites core/IPC/UI documentados.
- `npm run check` es la puerta de calidad local y de CI.

Salida: instalación reproducible y constantes de E-series trazables a E5.
El OCR del Reference Manual escaneado (RM3) queda diferido: no es normativo
y no bloquea el core mínimo.

## Fase 1 — Core mínimo

Estado: **cerrada** para el perfil MC68HC11E9.

- Registros CPU y CCR, bus de 64 KiB e INIT.
- `reset` de modo normal y `step` de NOP.
- Snapshot IPC e inspector mínimo, sin Dockview.

Salida: pruebas unitarias contra entradas E5 `human_verified`. El resto de la
ISA y los periféricos quedan para fases posteriores.

## Fase 2 — Instrucciones

- Decodificación por páginas de opcode.
- Modos de direccionamiento, flags y ciclos.
- Casos de prueba por fila de tabla oficial.

Salida: ninguna instrucción sin opcode, operandos, flags, ciclos y cita revisada.

## Fase 3 — Periféricos

Timer/RTI/COP, SCI, SPI, puertos, A/D y memoria no volátil por perfil. Salida:
eventos y registros con semántica temporal comprobada por subsistema.

## Fase 4 — Aplicación

Depurador, registros, memoria, desensamblado y control de ejecución mediante
snapshots IPC versionados. Salida: UI sin lógica de emulación duplicada.

## Fase 5 — Compatibilidad

ROMs de prueba legalmente redistribuibles o generadas, pruebas diferenciales y
matriz por variante. Las discrepancias se registran antes de cambiar conducta.
