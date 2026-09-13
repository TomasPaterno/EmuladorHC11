# Registro de discrepancias

## D-001 — Revisión pública de E-series

- Estado: abierta
- Corpus: E5 Rev. 5 (junio de 2003)
- Publicación actual de NXP: Rev. 5.1 (julio de 2005)
- Decisión: esta base cita E5. Rev. 5.1 sólo prueba que existe una revisión
  posterior; no se importan sus cambios sin incorporarla y revisarla como una
  fuente nueva.

## D-002 — Paginación física de RM3

- Estado: abierta, bloquea aprobación de datos A8
- Hecho: la copia preservada tiene 498 páginas y es un escaneo sin texto
  utilizable; otras digitalizaciones del mismo manual difieren en páginas
  preliminares y blancas.
- Decisión: se conservan secciones y páginas impresas verificadas en el índice,
  pero `pdf_page` permanece `null` hasta inspección visual página por página.
  El OCR masivo de RM3 no forma parte de la Fase 0: el texto derivado no
  autoriza constantes y el pipeline falló en páginas vacías del escaneo.

## D-003 — A8 frente a E-series

- Estado: separación intencional, no conflicto resuelto
- Hecho: RM3 §1.1 describe A8 con 256 B RAM, 512 B EEPROM y 8 KiB ROM; E5 §1.3
  lista capacidades diferentes según miembro E.
- Decisión: perfiles y mapas independientes. Nunca se hereda capacidad de una
  familia por similitud del núcleo CPU.

## D-004 — Reset determinista de A, B, X, Y y SP

- Estado: abierta, decisión de emulador
- Variante: MC68HC11E9
- Fuente: E5 §5.3.1, printed/pdf p. 94 (`visual_review: true`, 2026-09-13)
- Hecho: tras reset, SP y los demás registros CPU son indeterminados; solo
  CCR.S, CCR.X y CCR.I quedan establecidos.
- Código: `Registers::after_reset` fuerza A, B, X, Y y SP a 0 para que Step/Run
  sean reproducibles.
- Impacto: un programa que lea esos registros antes de inicializarlos verá 0
  en lugar de un valor indefinido de silicio.
- Resolución: se conserva el cero determinista. No se presenta como valor
  documentado por E5. `foundation.md` sigue prohibiendo inventar valores
  iniciales; este caso es una excepción explícita de emulador.

## D-005 — Overlay de sesión fuera del mapa E9

- Estado: abierta, decisión de emulador
- Variante: MC68HC11E9
- Fuente: E5 Figure 2-4, printed/pdf p. 37 (`visual_review: true`, 2026-09-13)
- Hecho: en modo normal el E9 mapea RAM `$0000–$01FF`, registros `$1000–$103F`,
  EEPROM `$B600–$B7FF` y ROM `$D000–$FFFF`. El resto es espacio externo.
- Código: `Bus` escribe un overlay de sesión en direcciones no internas para
  listings de laboratorio (`$2000` / `$3000`). No forma parte del mapa E9.
- Impacto: un S19 o listado puede ejecutarse fuera de RAM/ROM internas; en
  silicio esas direcciones exigirían bus externo.
- Resolución: se conserva el overlay como ayuda de laboratorio. Las regiones
  internas siguen a E5.

## Plantilla

Cada nueva entrada debe incluir estado, variantes, ambas citas completas,
impacto observable y resolución. Una resolución por revisión posterior debe
señalar exactamente qué fuente prevalece.
