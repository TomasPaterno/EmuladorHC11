# Estado del proyecto

Fecha de auditoría: 2026-09-13.

Este documento fija el **objetivo** del emulador y el **punto de avance**
respecto del código y las fuentes actuales. Complementa
[docs/roadmap.md](roadmap.md); no lo reemplaza.

## Objetivo

Construir un emulador de escritorio de la familia Motorola M68HC11 que:

1. Ejecute un núcleo Rust **determinista**, independiente de Tauri, React,
   filesystem, red y reloj de pared.
2. Tome como autoridad los PDFs oficiales del corpus (`E5` para E-series;
   `RM3` para explicación familiar y A8). Ningún opcode, ciclo, flag, mapa o
   registro entra al código sin `source_id` y, si la fuente es PDF, revisión
   visual.
3. Exponga el estado mediante **snapshots IPC versionados**. La UI React
   presenta y solicita acciones; no replica semántica de CPU.
4. Empiece por el perfil **MC68HC11E9** y, más adelante, cubra ISA, periféricos,
   depurador y compatibilidad por variante.

El producto buscado no es un simulador genérico “HC11”. Cada ejecución elige un
perfil concreto. Hoy el único perfil ejecutable es E9.

## Dónde estamos

| Fase | Nombre                                                       | Estado                             |
| ---- | ------------------------------------------------------------ | ---------------------------------- |
| 0    | Fundación (scaffold, corpus, política de fuentes, CI)        | **Cerrada**                        |
| 1    | Core mínimo E9 (registros, bus, INIT, reset, NOP, inspector) | **Cerrada**                        |
| 2    | Instrucciones (decode, modos, flags, ciclos)                 | **En curso** — 287 filas Table 4-2 |
| 3    | Periféricos                                                  | Pendiente                          |
| 4    | Aplicación (depurador, memoria, desensamblado)               | Inspector con hex 256 B y diffs    |
| 5    | Compatibilidad (ROMs de prueba, matriz de variantes)         | Pendiente                          |

**Conclusión:** la Fase 2 tiene 287 filas de Table 4-2 ejecutables y
comparadas en CI contra `instructions.yaml`. El inspector muestra un volcado
de 256 bytes más el último paso. El resto de la ISA, periféricos e
interrupciones siguen fuera.

## Auditoría rápida (2026-09-13)

### Núcleo Rust (`src-tauri/src/core`)

Presente y acotado:

- Modelo de programador: A, B, D, X, Y, SP, PC, CCR (`S X H I N Z V C`).
- Bus de 64 KiB con overlay E9: registros, RAM 512 B, EEPROM 512 B, ROM 12 KiB.
- Relocalización INIT (`$01` al reset: RAM `$0000`, registros `$1000`) y
  ventana de escritura de 64 ciclos E.
- Reset de modo normal: PC desde `$FFFE/$FFFF`, CCR con S, X e I; 3 ciclos de
  fetch del vector.
- Decode por páginas `$00`, `$18`, `$1A` y `$CD` (287 filas en total).
  `$1A` incluye CPD y CPY INDX; `$CD` incluye CPD/CPX INDY. El resto de
  prefijos sigue en `unimplemented_opcode`.
- `step` produce un `StepTrace` (PC, bytes, ciclos, registros/CCR que
  cambiaron, escrituras). Un opcode no implementado no muta el estado.
- `run(max_steps)` (1…10_000) itera `step` y para por cupo o por opcode
  pendiente. `inspect_memory` lee hasta 256 bytes sin ejecutar.
- `load_bytes` escribe RAM/EEPROM/ROM (máx. 4096 B) y rechaza registros y
  espacio no mapeado.
- `load_image` aplica un S19 parseado de forma atómica; el adaptador acepta
  Motorola S0/S1/S5/S9 y el inspector puede cargar un archivo de sesión.

Ausente:

- Resto de Table 4-2 (SBCA/SBCB, DAA, IDIV/FDIV, SWI/WAI/STOP/RTI,
  BVC/BVS/BRN).
- Carpeta `peripherals/`.
- Manejo de interrupciones, modos distintos del reset normal y perfiles
  ejecutables distintos de E9.

Nota de semántica: A, B, X, Y y SP se ponen a 0 tras reset **solo para
determinismo**. E5 §5.3.1 los declara indeterminados; el código lo documenta.

### IPC Tauri

Comandos: `reset`, `step`, `run`, `inspect_memory`, `write_memory`,
`load_bytes`, `load_s19` y `load_listing`. `step`/`run` devuelven
`{ snapshot, lastStep, memoryView, run? }`. `write_memory` escribe un byte
por el bus de CPU y devuelve `{ snapshot, memoryView }`. `schemaVersion` del
snapshot se mantiene en 1. Sin plugins de filesystem.

Hay pruebas de `load_s19`, del DTO de `step` y de los límites de `run` /
`inspect_memory`. El adaptador no expone filesystem ni red.

### UI React

Inspector de una sola página: Reset, Step, Run, carga hexadecimal, S19 o
listado, tabla de registros, volcado 16×16 con scroll de 64 KiB, hex/binario
y edición por doble clic, panel de último paso y origen de ventana (PC,
primer rango S19 o dirección). La UI solo pinta `lastStep` y `memoryView`.

`dockview-react` está en `package.json` y **no se usa**. Hay
`src/features/inspector/` y no hay pruebas TypeScript.

### Fuentes y especificación

Corpus local: `E31`, `E5` (autoridad E-series) y `RM3` (escaneo; no normativo
hasta revisión visual). YAML de `docs/hardware/spec/` revisado a
`human_verified` para E-series: variantes, registros, mapa e INIT, vectores
y las 287 filas de `instructions.yaml`.

Bloqueado para código:

- Perfil A8 (`pending_pdf_page` / `pending_pdf_page_and_addresses`).
- Tabla de vectores A8 vacía a propósito.
- OCR de RM3: no es evidencia.

Discrepancias abiertas: D-001 (E5 Rev. 5 vs NXP 5.1), D-002 (paginación RM3),
D-003 (A8 ≠ E-series), D-004 (reset determinista de A/B/X/Y/SP), D-005
(overlay de sesión fuera del mapa E9).

### Calidad

- `npm run check` es la puerta local y de CI (Windows, macOS, Ubuntu).
- 110 pruebas Rust: ISA (olas 1–2, laboratorio y candado YAML↔decode/CCR/E9),
  decode, addressing, S19 e IPC.
- Sin pruebas de UI.
- El repositorio Git no tiene commits; todo el árbol está sin historial.

## Qué se puede hacer hoy

1. Abrir la app (`npm run tauri dev`).
2. Cargar bytes o un S19 de sesión (p. ej. LDAA/STAA/ramas de la ola 1).
3. Step o Run; el hex y el panel de último paso muestran PC, registros, CCR
   y bytes escritos.

No se puede desensamblar de forma completa, simular timer/SCI/SPI/A-D ni
elegir otra variante.

## Siguiente tramo

Completar olas siguientes de Table 4-2. El perfil sigue siendo MC68HC11E9.

No abrir periféricos (Fase 3) ni el depurador completo (Fase 4) hasta cubrir
más ISA. No generar código desde datos A8 ni desde RM3 sin `pdf_page` e
inspección visual.
