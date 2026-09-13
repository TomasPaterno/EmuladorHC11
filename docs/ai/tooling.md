# Política mínima de tooling IA

## Principio

Usar herramientas locales de lectura, búsqueda, edición y terminal para el repositorio. No añadir un MCP cuando una capacidad local cubre la tarea de forma más simple y auditable.

## MCP permitidos

- **Context7 (secundario):** solo para documentación actual de librerías o APIs cuando la documentación instalada y el código del repositorio no sean suficientes. No usarlo como fuente de verdad del HC11.
- **GitHub (futuro, solo lectura):** podrá habilitarse para consultar upstream, issues, PRs, releases y código público. Quedan prohibidas mutaciones, comentarios, merges, ramas, releases y cambios de configuración.
- **Playwright (futuro):** podrá habilitarse para verificación local de flujos UI. No usar con credenciales reales, datos sensibles ni acciones destructivas.

La habilitación futura debe ser explícita, con alcance mínimo y revisión de permisos.

## MCP excluidos

- No usar MCP de filesystem: duplica las herramientas locales y amplía innecesariamente la superficie de acceso.
- No usar MCP de sequential-thinking: el razonamiento no requiere un servicio externo.
- No incorporar otros MCP sin una necesidad documentada y aprobación explícita.

## Evidencia de hardware

Los MCP no sustituyen fuentes primarias. Toda afirmación HC11 exige `source_id`. En PDF, además se debe inspeccionar visualmente la página citada y registrar `visual_review: true`; OCR o extracción textual no son suficientes.

## Registro

Cuando se use un MCP permitido, registrar propósito, consultas relevantes, datos incorporados y limitaciones. No enviar ROMs, dumps de memoria, rutas privadas, secretos ni contenido propietario.

## Evaluación de esta base

- Context7 se usó para contrastar el scaffold con la documentación mantenida por
  `tauri-apps/tauri-docs` y `tailwindlabs/tailwindcss.com`. Confirmó
  `npm create tauri-app@latest`, los prerrequisitos Linux de Tauri v2 y el uso de
  `@tailwindcss/vite` más `@import "tailwindcss"`.
- No se habilitó un MCP adicional: el corpus HC11 es local y las herramientas
  nativas cubren Git, filesystem, edición y terminal.
- GitHub y Playwright quedan diferidos hasta que exista, respectivamente, una
  necesidad concreta de inspeccionar upstream o una interfaz funcional que
  probar.

Context7 aporta documentación secundaria del stack; las URLs oficiales quedan
en `docs/setup.md`. Nunca se usa para resolver semántica del HC11.
