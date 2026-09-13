# Arquitectura

## Límites

1. **Core Rust**: estado CPU, bus de memoria, mapa seleccionado, periféricos,
   reloj lógico y transición `step/reset`. Debe ser determinista y no depender de
   Tauri, React, filesystem, red ni reloj del host.
2. **Adaptador Tauri**: posee la instancia del core, valida comandos y traduce
   tipos internos a contratos IPC versionados.
3. **Frontend React**: presenta estado y solicita acciones. Nunca decide
   semántica de instrucciones ni mantiene una segunda CPU autoritativa.

## Dirección de dependencias

`React -> comandos/snapshots IPC -> adaptador Tauri -> core`

El core no importa capas a su izquierda. Los perfiles de variante son datos
validados; seleccionan mapas y capacidades sin condicionales dispersos.

## Estado y tiempo

- Una transición del core recibe entradas explícitas y produce estado/eventos.
- El contador de ciclos emulados es tiempo lógico.
- Pausa, velocidad de UI y frecuencia de refresco no alteran resultados.
- Un snapshot es una proyección inmutable y serializable, no acceso compartido
  al estado interno.

## Árbol objetivo

```text
src-tauri/src/
  core/
    cpu/
    memory/
    peripherals/
    variant/
  ipc/
src/
  features/
  ipc/
  components/
docs/hardware/spec/
```

La ubicación bajo `src-tauri` es inicialmente práctica; el core debe poder
extraerse a un crate independiente sin cambios semánticos.

## Contratos

Los comandos mutadores serán pequeños (`reset`, `step`, carga controlada de
imagen) y devolverán snapshots. Cada snapshot lleva versión de esquema, variante,
registros, ciclos y sólo las ventanas de memoria requeridas. Los errores cruzan
IPC como códigos estables más un mensaje diagnóstico.

Decisiones relacionadas: [core/Tauri](decisions/0001-core-tauri-boundary.md),
[snapshots IPC](decisions/0002-ipc-snapshots.md) y
[perfiles](decisions/0003-variant-profiles.md).
