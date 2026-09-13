# Registro de revisión visual

Fecha: 2026-09-11

Documento: `E5` — M68HC11E Family Data Sheet, Rev. 5.

Se compararon directamente las páginas renderizadas del PDF original:

- p. 17: capacidades por variante de Figure 1-1.
- pp. 36–38: mapas de memoria E0, E1, E9, E20 y E2.
- p. 50: dirección, bits, reset y restricción de escritura de INIT.
- pp. 74–79: A, B, D, IX, IY, SP, PC, CCR y orden de bytes.
- p. 44: prioridad registro > RAM > ROM.
- p. 51: tablas 2-4 y 2-5 de relocación INIT.
- pp. 93–94: vector de reset normal `$FFFE` y bits S/X/I.
- p. 85: NOP inherente, opcode `$01`, 2 ciclos, CCR inalterado.
- pp. 80–87: Table 4-2 completa (hojas 1–7). Se contrastaron mnemónico,
  modo, opcode/prefijo, bytes, ciclos y columnas CCR de la ola 1
  (`docs/hardware/spec/instructions.yaml`).
- pp. 81–87: ola laboratorio (INDY de la página 0 ya implementada, INC/DEC/CLR
  memoria, ADCA/ADCB IMM, JMP/JSR indexados, BSET/BCLR/BRSET/BRCLR,
  MUL `$3D`, LDY/STY y LDS/STS). Cada fila nueva de
  `instructions.yaml` se contrastó en la hoja renderizada.
- p. 81: ADCA IMM/DIR/EXT/INDX/INDY `$89/$99/$B9/$A9/$18 A9`; ADCB IMM `$C9`;
  BCLR `$15/$1D/$18 1D`.
- p. 82: BRCLR `$13/$1F/$18 1F`; BRSET `$12/$1E/$18 1E`; BSET `$14/$1C/$18 1C`;
  CLR EXT/INDX/INDY `$7F/$6F/$18 6F`.
- p. 83: DEC INDX/INDY `$6A/$18 6A`; CMPA INDY `$18 A1`; EORA INDY `$18 A8`.
- p. 84: INC `$7C/$6C/$18 6C`; JMP INDX/INDY `$6E/$18 6E`; JSR DIR/INDX/INDY
  `$9D/$AD/$18 AD`; cargas INDY y LDS/LDY (incl. `$1A EE`, `$CD EE`).
- p. 85: MUL INH `$3D`, 10 ciclos; N/Z/C actualizan, V no; ORAA INDY `$18 AA`.
- p. 86: STAA/STAB/STD/STS/STY/STX INDY y SUBA/SUBB INDY.
- p. 83: DEC EXT `$7A`, 3 bytes, 6 ciclos.
- p. 84: LDAB INDX `$E6`, 2 bytes, 4 ciclos.
- p. 86: STAA INDX `$A7`, 2 bytes, 4 ciclos.
- p. 99: tabla completa de vectores de interrupción y reset.

Resultado: las páginas y valores E-series usados en `spec/` coinciden con el
original y pasan a `human_verified`. Esta revisión no aprueba datos del perfil
A8 ni sustituye la inspección del documento `RM3`.

## Auditoría de fidelidad (2026-09-13)

Muestreo visual del PDF `E5` Rev. 5 (`M68HC11E_Family.pdf`), páginas
renderizadas otra vez:

- p. 17 Figure 1-1: E9 = 512 B RAM, 12 KiB ROM, 512 B EEPROM.
- p. 37 Figure 2-4: RAM `$0000–$01FF`, registros `$1000–$103F`, EEPROM
  `$B600–$B7FF`, ROM `$D000–$FFFF`, vectores normales `$FFC0–$FFFF`.
- p. 50 §2.3.3.2 / Figure 2-12: INIT en `$103D`, reset `$01`, escritura una
  sola vez en los primeros 64 ciclos E.
- p. 51 Tables 2-4 y 2-5: nibble de página × `$1000`.
- pp. 74–79: modelo A/B/D/X/Y/SP/PC, CCR `S X H I N Z V C`, MSB en la
  dirección menor, TAP no puede poner X a 1 (p. 78).
- pp. 93–94 Table 5-2 / §5.3.1–5.3.2: vector normal `$FFFE/$FFFF`, fetch de
  3 ciclos E, A/B/X/Y/SP indeterminados, CCR S/X/I, INIT `$01`.
- p. 99 Table 5-4: 21 vectores `$FFD6–$FFFF`; el núcleo no simula el trap de
  opcode ilegal ni el resto de interrupciones.
- Table 4-2 (pp. 80–87), subconjunto: `NOP` `$01`/2; `TAP` `$06`/X↓;
  `MUL` `$3D`/10 ciclos; `ADDA`/`SUBA` IMM; `LDAA` DIR/EXT/INDX; `INC`/`CLR`
  EXT; `BSET`/`BRSET` DIR; `INY` `$18 08`; `LDY INDX` `$1A EE`; `LDX INDY`
  `$CD EE`; `BRA`/`BEQ` 3 ciclos fijos (E5 no lista 3/4); `JSR`/`RTS`.

Hallazgo corregido: `CMPA INDY` en `instructions.yaml` tenía `c: unchanged`;
Table 4-2 p. 83 actualiza C en todos los modos de CMPA. El execute ya lo
hacía. Desvíos de emulador: D-004 (reset a 0) y D-005 (overlay de laboratorio).
