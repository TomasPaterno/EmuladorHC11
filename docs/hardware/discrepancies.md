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

## Plantilla

Cada nueva entrada debe incluir estado, variantes, ambas citas completas,
impacto observable y resolución. Una resolución por revisión posterior debe
señalar exactamente qué fuente prevalece.
