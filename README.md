# Emulador HC11

Base de una aplicación de escritorio para emular la familia Motorola M68HC11. La
interfaz usa React/TypeScript y Tauri v2; el núcleo se implementará en Rust como una
biblioteca determinista e independiente de la interfaz.

El núcleo E9 ejecuta reset, carga de bytes o de un S19 de sesión, Step/Run
de 172 filas verificadas de E5 Table 4-2 y un visor hex de 256
bytes con el último cambio. El resto de la ISA y los periféricos todavía no
están implementados.

## Documentación

- [Estado actual](docs/status.md)
- [Preparación del entorno](docs/setup.md)
- [Arquitectura](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Corpus oficial de hardware](docs/hardware/sources.md)
- [Fundamentos del HC11](docs/hardware/foundation.md)
- [Especificación revisable](docs/hardware/spec/)

## Inicio rápido

```powershell
npm ci
npm run tauri dev
```

Eso abre una **ventana de escritorio** (Tauri). No use `npm run dev` ni
`http://localhost:1420` en Chrome/Edge: ahí no hay IPC y el inspector falla.
`npm run dev` solo lo lanza Tauri por debajo.

Los valores de hardware no se aceptan sin una cita resoluble al documento,
revisión, sección, página impresa y página PDF. Consulte la
[política de fuentes](docs/decisions/0004-source-policy.md).

La Fase 1 está cerrada para MC68HC11E9. Consulte [docs/roadmap.md](docs/roadmap.md).
