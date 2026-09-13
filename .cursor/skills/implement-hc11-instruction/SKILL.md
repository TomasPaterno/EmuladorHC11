---
name: implement-hc11-instruction
description: Implementa o corrige instrucciones Motorola 68HC11 en Rust con semántica, flags, direccionamiento y ciclos trazables. Usar al añadir opcodes o reparar ejecución de CPU.
---

# Implementar instrucción HC11

## Antes de editar

1. Cargar `research-hc11-hardware`.
2. Confirmar variante, opcode/prefijo, longitud, modos, ciclos y efectos CCR.
3. Registrar al menos un `source_id`; para PDF exigir `visual_review: true`.
4. Inspeccionar patrones existentes de decode, operandos, memoria y errores.

## Implementación

- Mantener fetch/decode separado de la semántica.
- Aplicar wrapping, signo y endianness explícitos.
- Calcular flags desde operandos y resultado con el ancho correcto.
- Contabilizar ciclos y PC una sola vez, incluidos caminos condicionales.
- No asignar semántica a opcodes reservados o indocumentados sin fuente.

## Pruebas obligatorias

- Vector nominal por modo de direccionamiento.
- Ceros, máximos, overflow, carry/borrow y valores negativos relevantes.
- Estado final de registros, memoria, PC, SP, CCR y ciclos.
- Opcode inválido y límites de memoria cuando correspondan.

La entrega debe listar `source_id`, archivos cambiados, vectores cubiertos y cualquier ambigüedad pendiente.
