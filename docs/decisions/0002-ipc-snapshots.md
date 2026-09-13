# ADR 0002: IPC mediante snapshots versionados

- Estado: aceptada
- Fecha: 2026-09-11

## Contexto

Exponer estado mutable o emitir un evento por ciclo acoplaría UI y frecuencia de
emulación, además de producir contratos difíciles de evolucionar.

## Decisión

Los comandos devolverán snapshots inmutables con `schema_version` explícita.
Incluirán variante, estado CPU, ciclos y regiones solicitadas. El frontend no
recibe referencias internas ni autoridad para modificar estado localmente.

## Consecuencias

La UI puede renderizar y grabar snapshots de forma estable. Deben limitarse las
ventanas de memoria y la frecuencia de publicación para evitar copias grandes.
Todo cambio incompatible exige una nueva versión y pruebas Rust/TypeScript del
contrato.
