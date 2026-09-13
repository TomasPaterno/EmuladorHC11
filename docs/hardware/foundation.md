# Fundamentos de hardware

## CPU común documentada

El espacio de direcciones es de 64 KiB y la E-series trata memoria y E/S como
direcciones del mismo mapa. El modelo del programador contiene A y B de 8 bits,
el acumulador compuesto D de 16 bits, X, Y, SP y PC de 16 bits, y CCR de 8 bits.
El orden de bits de CCR es `S X H I N Z V C`.

Una palabra ocupa dos direcciones consecutivas y su byte más significativo está
en la dirección menor. La pila crece hacia direcciones menores; SP señala la
siguiente posición libre. Estas afirmaciones proceden de
`E5:4.1-4.3:73-79:73-79`.

## Reset

Tras reset, PC se carga desde el vector correspondiente. SP y los demás
registros CPU son indeterminados; CCR.X, CCR.I y CCR.S quedan establecidos. En
E-series, INIT vale `$01`: RAM comienza en `$0000` y el bloque de 64 registros
en `$1000`. Fuente: `E5:5.3.1-5.3.2:94:94`.

## Memoria E-series

RAM y registros pueden moverse al comienzo de cualquier página de 4 KiB mediante
INIT. Los registros tienen prioridad sobre RAM y RAM sobre ROM cuando se
solapan. Las capacidades internas dependen del dispositivo; consulte
`spec/variants.yaml` y `spec/memory-map.yaml`. Fuentes:
`E5:2.3-2.3.3.2:35-51:35-51`.

## A8 no es un alias de E-series

RM3 describe MC68HC11A8 con 8 KiB ROM, 512 bytes EEPROM y 256 bytes RAM
(`RM3:1.1:1-1:null`). Comparte el modelo CPU de siete registros, pero sus
periféricos y mapa se mantienen en un perfil separado. La página PDF de esta
fuente escaneada sigue pendiente; por política, los datos A8 no están aprobados
para generar código.

## Restricciones de implementación

- Cada reset, lectura, escritura e interrupción se evalúa contra una variante y
  modo concretos.
- No se asignan valores iniciales a registros que la fuente deja indeterminados.
- El byte alto de palabras se almacena en la dirección menor.
- Los vectores contienen direcciones de 16 bits, no código ejecutable.
- Ningún dato `pending_pdf_page` se convierte en constante del emulador.
