# Especificación estructurada

Estos YAML son datos de revisión, no entrada automática del emulador. CI
**compara** las filas `human_verified` con el inventario de decode, los
ciclos/CCR ejecutados y las constantes E9; no genera `decode.rs`.

- `variants.yaml`: capacidades por dispositivo.
- `cpu-registers.yaml`: modelo CPU común.
- `memory-map.yaml`: mapa al salir de reset por perfil.
- `interrupt-vectors.yaml`: direcciones de vectores.
- `instructions.yaml`: 287 filas de Table 4-2 (opcode, modo, ciclos, CCR).

Estados `transcribed_needs_visual_check` y `pending_*` bloquean generación de
código. Una entrada sólo podrá pasar a `human_verified` después de comparar
visualmente valor y cita con el PDF original. `null` representa un dato no
verificado y no puede sustituirse por una inferencia.

Los enteros se expresan en decimal o con prefijo hexadecimal `0x`. Los rangos son
inclusivos. Toda entrada factual debe resolver a uno de `E31`, `E5` o `RM3`
definidos en `../sources.md`.
