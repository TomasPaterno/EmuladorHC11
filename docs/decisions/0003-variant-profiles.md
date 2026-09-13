# ADR 0003: Perfiles explícitos de variante

- Estado: aceptada
- Fecha: 2026-09-11

## Contexto

M68HC11 describe una familia. RAM, ROM/EPROM, EEPROM, registros y ciertos
periféricos difieren entre A8 y miembros E-series.

## Decisión

Cada ejecución selecciona un perfil inmutable. El perfil referencia mapas,
vectores y capacidades revisados en `docs/hardware/spec`; no existe una
"variante HC11 genérica" ejecutable. Los datos comunes se comparten sólo cuando
la fuente los declara comunes.

## Consecuencias

Los tests indican variante y modo. Añadir un dispositivo exige un perfil con
citas completas y revisión humana; no se rellena una ausencia copiando datos de
otro miembro.
