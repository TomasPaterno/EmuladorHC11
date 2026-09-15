export type ExampleDifficulty = "Principiante" | "Intermedio" | "Avanzado";

export interface ProgramExample {
  id: string;
  filename: string;
  title: string;
  difficulty: ExampleDifficulty;
  topics: string[];
  summary: string;
  expectedOutput: string;
  code: string;
}

export const EXAMPLES: ProgramExample[] = [
  {
    id: "fibonacci-8bit",
    filename: "01-fibonacci-8bit.lst",
    title: "Sucesión de Fibonacci (8 bits)",
    difficulty: "Intermedio",
    topics: ["Bucles", "Indexado IX", "Suma 8-bit", "RAM"],
    summary:
      "Calcula y almacena en RAM ($0000..$000C) los primeros 13 números de Fibonacci que caben en 8 bits (hasta 233).",
    expectedOutput:
      "RAM $0000..$000C contiene: $00, $01, $01, $02, $03, $05, $08, $0D, $15, $22, $37, $59, $90, $E9.",
    code: `; ==========================================================
; EJEMPLO 1: Sucesión de Fibonacci (8 bits)
; Dificultad: Intermedia
; Conceptos: Bucles, direccionamiento indexado (IX), suma en 8 bits
;
; Genera los primeros 13 números de Fibonacci en RAM ($0000..$000C):
; 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233
; ==========================================================
1 0000
2 2000
3 2000 CE 00 00 ; LDX #$0000 - Puntero base del arreglo en RAM
4 2003 6F 00    ; CLR 0,X    - Fib(0) = 0
5 2005 C6 01    ; LDAB #$01  - Valor inicial 1
6 2007 E7 01    ; STAB 1,X   - Fib(1) = 1
7 2009 C6 0B    ; LDAB #$0B  - Contador: 11 términos restantes
; --- Bucle de suma secuencial ---
8 200B A6 00    ; LDAA 0,X   - Carga Fib(i-2)
9 200D AB 01    ; ADDA 1,X   - Suma Fib(i-1) -> A = Fib(i)
10 200F A7 02   ; STAA 2,X   - Almacena Fib(i) en 2,X
11 2011 08      ; INX        - Desplaza puntero al siguiente elemento
12 2012 5A      ; DECB       - Decrementa contador de iteraciones
13 2013 26 F6   ; BNE $200B  - Si no es cero, repite el bucle
; --- Fin del programa ---
14 2015 7E 20 15 ; JMP $2015 - Bucle infinito de detención`,
  },
  {
    id: "conteo-bits-shift",
    filename: "02-conteo-bits-shift.lst",
    title: "Conteo de Bits en 1 (Shift y Acarreo)",
    difficulty: "Intermedio",
    topics: ["Desplazamiento LSRA", "Bandera Carry (C)", "Saltos BCC"],
    summary:
      "Cuenta los bits en '1' que tiene un byte en $0050 mediante desplazamientos lógicos hacia la derecha y la bandera Carry del CCR.",
    expectedOutput:
      "Para el dato de entrada $B7 (%10110111), guarda el total de 6 unos en la dirección $0052.",
    code: `; ==========================================================
; EJEMPLO 2: Conteo de bits en 1 mediante rotación/shift
; Dificultad: Básica-Intermedia
; Conceptos: Desplazamiento lógico (LSRA), bandera Carry (C), bucle
;
; Cuenta cuántos bits en '1' contiene un byte almacenado en $0050.
; El dato de prueba $B7 (%10110111) contiene 6 unos.
; El resultado se almacena en la dirección de memoria $0052.
; ==========================================================
1 0000
2 2000
3 2000 86 B7    ; LDAA #$B7  - Carga dato de prueba con 6 bits en '1'
4 2002 97 50    ; STAA $50   - Guarda en variable de entrada $0050
5 2004 5F       ; CLRB       - B = 0 (Contador de unos encontrados)
6 2005 CE 00 08 ; LDX #$0008 - X = 8 (Contador de iteraciones / 8 bits)
; --- Bucle de análisis bit a bit ---
7 2008 44       ; LSRA       - Desplaza A a la derecha; bit 0 entra a Carry (C)
8 2009 24 01    ; BCC $200C  - Si Carry=0, salta el incremento de B
9 200B 5C       ; INCB       - Si Carry=1, incrementa el contador de unos
10 200C 09      ; DEX        - Decrementa contador de bits restantes
11 200D 26 F9   ; BNE $2008  - Si quedan bits (X != 0), repite bucle
; --- Almacenar resultado ---
12 200F D7 52   ; STAB $52   - Guarda el total de unos en memoria $0052
13 2011 7E 20 11 ; JMP $2011 - Bucle infinito de detención`,
  },
  {
    id: "evaluacion-sensor",
    filename: "03-evaluacion-sensor.lst",
    title: "Evaluación de Sensor y Alarma",
    difficulty: "Principiante",
    topics: ["Comparación CMPA", "Bifurcación BHS", "Toma de Decisiones"],
    summary:
      "Compara la lectura de un sensor en $0040 con un umbral crítico (53°C). Si se supera, activa alarma ($0042 = $FF); si no, la apaga ($00).",
    expectedOutput:
      "Alarma activada ($0042 = $FF) porque la lectura de prueba ($3A = 58°C) supera el umbral ($35 = 53°C).",
    code: `; ==========================================================
; EJEMPLO 3: Control de umbral de sensor y bifurcaciones
; Dificultad: Básica
; Conceptos: Comparaciones (CMPA), bifurcación condicional (BHS/BLO), E/S
;
; Simula la lectura de un sensor de temperatura en $0040.
; Si Temperatura >= Umbral ($35 = 53°C), activa alarma ($0042 = $FF).
; Si Temperatura < Umbral, apaga la alarma ($0042 = $00).
; ==========================================================
1 0000
2 2000
3 2000 86 3A    ; LDAA #$3A  - Simula lectura de sensor (58°C)
4 2002 97 40    ; STAA $40   - Guarda lectura en sensor_in ($0040)
5 2004 81 35    ; CMPA #$35  - Compara lectura con umbral crítico (53°C)
6 2006 24 07    ; BHS $200F  - Si A >= $35 (Carry=0), salta a ALARMA
; --- Caso Normal (Por debajo del umbral) ---
7 2008 86 00    ; LDAA #$00  - Código de estado: Normal / Seguro
8 200A 97 42    ; STAA $42   - Alarma apagada en $0042
9 200C 7E 20 14 ; JMP $2014  - Salta al final
; --- Caso Alarma (Umbral superado) ---
10 200F 86 FF   ; LDAA #$FF  - Código de estado: Alarma activa
11 2011 97 42   ; STAA $42   - Alarma encendida en $0042
; --- Fin del programa ---
12 2013 01      ; NOP        - Punto de sincronización
13 2014 7E 20 14 ; JMP $2014 - Bucle infinito de detención`,
  },
  {
    id: "subrutinas-pila",
    filename: "04-subrutinas-y-pila.lst",
    title: "Subrutinas y Gestión de la Pila",
    difficulty: "Avanzado",
    topics: [
      "Subrutinas JSR/RTS",
      "Stack Pointer (SP)",
      "Push/Pull (PSHB/PULB)",
    ],
    summary:
      "Calcula |Num1| + |Num2| mediante una subrutina de valor absoluto. Permite observar cómo JSR apila la dirección de retorno y RTS la restaura.",
    expectedOutput:
      "|-15| + |+25| = 15 + 25 = 40 ($28), almacenado en $0032. En la pila se aprecia el apilamiento y desapilamiento exacto de SP.",
    code: `; ==========================================================
; EJEMPLO 4: Subrutinas y manipulación de Pila (Stack)
; Dificultad: Avanzada
; Conceptos: Inicialización LDS, llamadas JSR, retorno RTS, preservación PSHB/PULB, Pila
;
; 1. Inicializa el Stack Pointer (SP) en $00FF (tope de la RAM interna).
;    ¡Obligatorio en 68HC11 antes de usar subrutinas o apilar datos!
; 2. Calcula |Num1| + |Num2| llamando a una subrutina de valor absoluto.
; 3. JSR apila la dirección de retorno en SP ($00FF-$00FE) y salta a la subrutina.
; 4. RTS desapila la dirección de retorno de SP y regresa fielmente al llamador.
; Num1 = -15 ($F1), Num2 = +25 ($19) -> Resultado esperado: 40 ($28) en $0032.
; ==========================================================
1 0000
2 2000
; --- 1. Inicialización obligatoria de Pila ---
3 2000 8E 00 FF ; LDS #$00FF    - Inicializa SP en el tope de RAM interna ($00FF)
; --- 2. Inicialización de variables ---
4 2003 86 F1    ; LDAA #$F1     - Num1 = -15 (en complemento a 2)
5 2005 97 30    ; STAA $30      - Almacena en $0030
6 2007 86 19    ; LDAA #$19     - Num2 = +25
7 2009 97 31    ; STAA $31      - Almacena en $0031
; --- 3. Primera llamada a subrutina ---
8 200B 96 30    ; LDAA $30      - Carga Num1 (-15) en acumulador A
9 200D BD 20 1C ; JSR $201C     - Llama a ABS_VAL (apila PC retorno $2010 en SP)
10 2010 16       ; TAB           - Guarda |Num1| (+15) en acumulador B
; --- 4. Segunda llamada a subrutina ---
11 2011 96 31   ; LDAA $31      - Carga Num2 (+25) en acumulador A
12 2013 BD 20 1C ; JSR $201C    - Llama a ABS_VAL (apila PC retorno $2016 en SP)
13 2016 1B      ; ABA           - A = A + B (15 + 25 = 40 = $28)
14 2017 97 32   ; STAA $32      - Guarda resultado en $0032
15 2019 7E 20 19 ; JMP $2019    - Bucle infinito de detención
; ==========================================================
; SUBRUTINA: ABS_VAL ($201C)
; Entrada: Acumulador A (número con signo)
; Salida:  Acumulador A (valor absoluto |A|)
; Modifica: A y banderas CCR. Preserva B en la pila.
; ==========================================================
16 201C 37      ; PSHB          - Preserva B en la pila (SP se decrementa a $00FB)
17 201D 2A 01   ; BPL $2020     - Si es positivo (N=0), salta el NEGA
18 201F 40      ; NEGA          - Si es negativo, aplica complemento a 2
19 2020 33      ; PULB          - Restaura B original desde la pila (SP vuelve)
20 2021 39      ; RTS           - Retorna desapilando dirección de retorno ($2010 o $2016)`,
  },
  {
    id: "maximo-vector",
    filename: "05-maximo-vector.lst",
    title: "Búsqueda de Máximo en Vector",
    difficulty: "Intermedio",
    topics: ["Puntero IX", "Arreglos", "Comparación BHI", "Bucles"],
    summary:
      "Recorre un arreglo de 5 elementos en $0060..$0064 para encontrar el valor máximo y almacenarlo en la dirección $0070.",
    expectedOutput:
      "Entre [$12, $8A, $45, $9F, $33], encuentra el máximo $9F (159 decimal) y lo guarda en $0070.",
    code: `; ==========================================================
; EJEMPLO 5: Búsqueda del Máximo en un Vector
; Dificultad: Intermedia
; Conceptos: Arreglos en RAM, punteros (IX), comparación sin signo (BHI)
;
; Busca el valor más grande en un arreglo de 5 elementos en $0060..$0064.
; Datos del vector: [$12, $8A, $45, $9F, $33].
; Guarda el valor máximo encontrado en la dirección de memoria $0070.
; ==========================================================
1 0000
2 2000
; --- Carga del vector en memoria RAM ($0060..$0064) ---
3 2000 CE 00 60 ; LDX #$0060 - Puntero base del vector
4 2003 86 12    ; LDAA #$12  - Elemento 0
5 2005 A7 00    ; STAA 0,X
6 2007 86 8A    ; LDAA #$8A  - Elemento 1
7 2009 A7 01    ; STAA 1,X
8 200B 86 45    ; LDAA #$45  - Elemento 2
9 200D A7 02    ; STAA 2,X
10 200F 86 9F   ; LDAA #$9F  - Elemento 3 (Máximo)
11 2011 A7 03   ; STAA 3,X
12 2013 86 33   ; LDAA #$33  - Elemento 4
13 2015 A7 04   ; STAA 4,X
; --- Algoritmo de búsqueda de máximo ---
14 2017 A6 00   ; LDAA 0,X   - A = Máximo provisional (primer elemento $12)
15 2019 C6 04   ; LDAB #$04  - B = 4 comparaciones restantes
; --- Bucle de comparación ---
16 201B 08      ; INX        - Avanza puntero al siguiente elemento
17 201C A1 00   ; CMPA 0,X   - Compara MáximoActual (A) con ElementoActual (0,X)
18 201E 22 02   ; BHI $2022  - Si MáximoActual > ElementoActual, mantiene A
19 2020 A6 00   ; LDAA 0,X   - Si no, actualiza Máximo con el nuevo valor
20 2022 5A      ; DECB       - Decrementa contador de elementos restantes
21 2023 26 F6   ; BNE $201B  - Si quedan elementos por revisar, repite bucle
; --- Almacenar resultado ---
22 2025 97 70   ; STAA $70   - Guarda el valor máximo ($9F) en $0070
23 2027 7E 20 27 ; JMP $2027 - Bucle infinito de detención`,
  },
  {
    id: "control-bits-hardware",
    filename: "06-control-bits-hardware.lst",
    title: "Manipulación Atómica de Bits (E/S)",
    difficulty: "Intermedio",
    topics: ["Instrucciones Bit", "BSET / BCLR", "Salto BRSET", "Periféricos"],
    summary:
      "Simula el control de un motor y un sensor de tope en un puerto de E/S ($0040) utilizando instrucciones nativas de bit del 68HC11.",
    expectedOutput:
      "Enciende motor (bits 0 y 1 en $0040), detecta activación de sensor (bit 7 en 1) y apaga de forma atómica únicamente el motor (bit 0 = 0).",
    code: `; ==========================================================
; EJEMPLO 6: Manipulación atómica de bits (BSET / BCLR / BRSET)
; Dificultad: Intermedia
; Conceptos: Operaciones a nivel de bit, máscaras, control de periféricos
;
; Simula el control de un motor en $0040:
; - Bit 0 ($01): Encendido/Apagado del Motor
; - Bit 1 ($02): Dirección de avance
; - Bit 7 ($80): Sensor de fin de carrera
; ==========================================================
1 0000
2 2000
3 2000 7F 00 40 ; CLR $0040        - Apaga todo en el puerto $0040
; --- Encendido del motor en avance (Bits 0 y 1) ---
4 2003 14 40 03 ; BSET $40 $03     - Activa bits 0 y 1 (Motor ON y Avance)
; --- Simulación: el sensor de fin de carrera se activa (Bit 7) ---
5 2006 14 40 80 ; BSET $40 $80     - Simula sensor fin de carrera activado
; --- Verificación con salto condicional de bit ---
6 2009 12 40 80 03 ; BRSET $40 $80 $2010 - Si bit 7 está en 1, salta a DETENER
; --- Si no estuviera activo, continuaría aquí ---
7 200D 01       ; NOP              - Espera
8 200E 01       ; NOP              - Espera
9 200F 01       ; NOP
; --- Detención del motor (Apaga solo bit 0, conserva otros) ---
10 2010 15 40 01 ; BCLR $40 $01     - Apaga Bit 0 (Motor OFF). Deja sentido y sensor
11 2013 7E 20 13 ; JMP $2013       - Bucle infinito de detención`,
  },
];
