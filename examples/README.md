# Colección de Programas de Ejemplo para Motorola 68HC11

Esta carpeta contiene programas en ensamblador y listados compilados (`.lst`) diseñados pedagógicamente para estudiantes y desarrolladores que deseen aprender y experimentar con la arquitectura del microcontrolador **Motorola 68HC11**.

---

## 📋 Catálogo de Ejemplos por Dificultad y Temas

| Archivo                                                          | Título                        |       Dificultad        | Temas y Conceptos Clave                                                        | Salida Esperada                                                                                   |
| :--------------------------------------------------------------- | :---------------------------- | :---------------------: | :----------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| [`01-fibonacci-8bit.lst`](./01-fibonacci-8bit.lst)               | Sucesión de Fibonacci         |     **Intermedio**      | Bucles, Direccionamiento Indexado (`0,X`), Suma 8-bit (`ADDA`), RAM            | Genera los primeros 13 números de Fibonacci en `$0000..$000C` ($0, 1, 1, 2, ..., 233).            |
| [`02-conteo-bits-shift.lst`](./02-conteo-bits-shift.lst)         | Conteo de Bits en 1           | **Básico - Intermedio** | Desplazamiento lógico (`LSRA`), Bandera Carry (`C`), Salto `BCC`               | Cuenta los bits en alto de un byte en `$0050` (ej: `$B7` $\to$ 6 unos en `$0052`).                |
| [`03-evaluacion-sensor.lst`](./03-evaluacion-sensor.lst)         | Evaluación de Sensor y Alarma |       **Básico**        | Comparación (`CMPA`), Bifurcación sin signo (`BHS`), Control E/S               | Compara lectura de sensor con umbral. Activa alarma (`$FF`) en `$0042` si supera 53°C.            |
| [`04-subrutinas-y-pila.lst`](./04-subrutinas-y-pila.lst)         | Subrutinas y Pila (Stack)     |      **Avanzado**       | Inicialización `LDS`, Llamada `JSR`, Retorno `RTS`, Preservación `PSHB`/`PULB` | Calcula $\|Num_1\| + \|Num_2\|$ llamando a una subrutina de valor absoluto (`$0032 = 40`).        |
| [`05-maximo-vector.lst`](./05-maximo-vector.lst)                 | Búsqueda del Máximo en Vector |     **Intermedio**      | Vectores en RAM, Punteros `IX`, Comparación sin signo (`BHI`), Bucles          | Halla el valor mayor en un arreglo de 5 elementos (`$0060..$0064` $\to$ Máximo `$9F` en `$0070`). |
| [`06-control-bits-hardware.lst`](./06-control-bits-hardware.lst) | Manipulación Atómica de Bits  |     **Intermedio**      | Operaciones de bit en memoria (`BSET`, `BCLR`, `BRSET`), Puertos E/S           | Controla un motor DC en `$0040` (enciende, detecta tope con sensor y apaga).                      |

---

## 🎯 Guía de Aprendizaje para el Alumno

### 1. Sucesión de Fibonacci (`01-fibonacci-8bit.lst`)

- **¿Qué demuestra?** Cómo utilizar el registro índice `X` (`LDX #$0000`) para recorrer arreglos continuos en memoria y cómo estructurar un bucle controlado por contador (`DECB` y `BNE`).
- **Punto de inspección**: Abre el panel de memoria **RAM / Datos** en la dirección `$0000` y observa cómo cada paso agrega el siguiente término de la sucesión. En el paso 13, observa que el valor `$E9` (233) es el último término almacenable en 8 bits (el siguiente sería 377 > 255).

### 2. Conteo de Bits en 1 (`02-conteo-bits-shift.lst`)

- **¿Qué demuestra?** El funcionamiento de los desplazamientos a la derecha (`LSRA`). El bit menos significativo (b0) entra directamente a la bandera de Acarreo (`C`) del registro de códigos de condición (CCR).
- **Punto de inspección**: En la tarjeta **Ruta de Datos (Datapath)** y en el visor de **CCR**, observa cómo la bandera **C** cambia entre `0` y `1` en cada desplazamiento, decidiendo si se ejecuta o no la instrucción `INCB`.

### 3. Evaluación de Sensor (`03-evaluacion-sensor.lst`)

- **¿Qué demuestra?** La toma de decisiones en microcontroladores embebidos. Compara un valor analógico/digital de sensor contra un umbral de seguridad y activa una señal de alarma.
- **Punto de inspección**: Revisa el banner de **Bifurcación (Branch)** en el visualizador para ver si la condición `BHS` (Higher or Same) es tomada o ignorada según el valor del sensor.

### 4. Subrutinas y Pila (`04-subrutinas-y-pila.lst`)

- **¿Qué demuestra?** La arquitectura del Stack Pointer (`SP`). En Motorola 68HC11, es **obligatorio inicializar el Stack Pointer** (`LDS #$00FF`) antes de invocar subrutinas o apilar datos, ya que tras el reset el puntero es indeterminado ($0000) y apilar sin inicializarlo desbordaría la pila hacia la zona de ROM ($FFFF), descartando la dirección de retorno. Demuestra cómo `LDS #$00FF` ubica la pila en la RAM interna, cómo `JSR` apila la dirección de retorno de 16 bits ($2010 y $2016), cómo `PSHB` guarda el acumulador en la pila, y cómo `PULB` y `RTS` restauran fielmente el flujo y contexto del llamador.
- **Punto de inspección**: Observa el **Inspector de Pila (Stack Viewer)**. Verás la dirección de retorno `$2010` marcada en color púrpura/cian en el tope de la pila (`TOS`), y luego retirada limpiamente al ejecutarse `RTS` volviendo a la instrucción `TAB` en `$2010`.

### 5. Búsqueda de Máximo en Vector (`05-maximo-vector.lst`)

- **¿Qué demuestra?** Manejo de datos estructurados (tablas/vectores) en memoria y algoritmo clásico de selección.
- **Punto de inspección**: Observa el acumulador `A` en el banco de registros. Al principio tiene `$12`, luego se actualiza a `$8A` y finalmente a `$9F` cuando encuentra elementos mayores.

### 6. Manipulación Atómica de Bits (`06-control-bits-hardware.lst`)

- **¿Qué demuestra?** Una de las mayores ventajas de la arquitectura Motorola 68HC11: instrucciones dedicadas para modificar (`BSET`/`BCLR`) o consultar (`BRSET`/`BRCLR`) bits individuales en puertos de hardware o memoria sin necesidad de hacer lecturas y máscaras manuales con `AND`/`OR`.
- **Punto de inspección**: Observa la dirección `$0040` en el panel de memoria y comprueba cómo los bits individuales cambian sin alterar los bits contiguos.
