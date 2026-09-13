# Fuentes oficiales

## Corpus autorizado

### `E31`

- Archivo: `68hc11_tech_data_rev3p1.pdf`
- Motorola, **M68HC11E Family Technical Data**, M68HC11E/D, Rev. 3.1,
  mayo de 2001, 336 páginas PDF.
- SHA-256: `8cc85c36795f69b10a6effd4cbd877a13f594a7dd0e1294e7bad8be6e0573faa`.
- Uso: contexto histórico y detección de cambios de E-series.

### `E5`

- Archivo: `M68HC11E_Family.pdf`
- Motorola/Freescale, **M68HC11E Family Data Sheet**, M68HC11E/D, Rev. 5,
  junio de 2003, 268 páginas PDF.
- SHA-256: `6ed3e84d7a3ad0db30dd11a6b640849f73a0e678b56a28b2fc6eab1d20c7095f`.
- Uso: autoridad del corpus para E-series.
- NXP publica actualmente el nombre documental
  [M68HC11E](https://www.nxp.com/docs/en/data-sheet/M68HC11E.pdf); el archivo
  servido actualmente es Rev. 5.1 (julio de 2005), no el Rev. 5 del corpus.
  No se mezclan ambas revisiones.

### `RM3`

- Archivo: `0900766b800344e4.pdf`
- Motorola, **M68HC11 Reference Manual**, M68HC11RM/AD, Rev. 3,
  copyright 1991, 498 páginas en la copia preservada.
- SHA-256: `8b43047f1ddded0ff28ef2530799a66752e717ef52cf961602b8f2829ab94a41`.
- Uso: explicación familiar y base A8. El propio manual indica en §1 que
  complementa, no reemplaza, la hoja de datos específica.

## Forma de una cita

`source_id:sección:página_impresa:página_pdf`, por ejemplo
`E5:4.2.6:77:77`. La página impresa es la numeración visible del documento; la
página PDF es la posición física, empezando en 1.

En E5 se verificó que las páginas técnicas citadas en esta base coinciden con la
posición PDF. RM3 es un escaneo sin capa de texto útil en el archivo local: donde
la posición física no fue inspeccionada visualmente, `pdf_page` queda `null` y la
entrada no se considera aprobada.

## Jerarquía

1. Hoja de datos más reciente de la variante objetivo dentro del corpus.
2. Manual familiar para comportamiento común.
3. Revisión anterior para contexto o para abrir una discrepancia.

Una fuente web o texto extraído nunca reemplaza la página original. Los hashes y
metadatos verificables se mantienen en `manifest.yaml`.
