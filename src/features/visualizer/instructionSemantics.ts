import { CpuSnapshot, LastStep } from "../../ipc/emulator";

export type OperationCategory =
  | "LOAD"
  | "STORE"
  | "ALU"
  | "BRANCH"
  | "JUMP"
  | "CALL"
  | "RETURN"
  | "STACK"
  | "TRANSFER"
  | "FLAG"
  | "SYSTEM";

export interface BranchAnalysis {
  isBranch: boolean;
  condition: string;
  taken: boolean;
  targetAddress: number;
  fallthroughAddress: number;
}

export interface InstructionSemantic {
  mnemonic: string;
  category: OperationCategory;
  categoryLabel: string;
  summary: string;
  detail: string;
  sourceBlock:
    "MEMORY" | "REGISTER" | "IMMEDIATE" | "ALU" | "STACK" | "PC" | "NONE";
  destBlock: "REGISTER" | "MEMORY" | "ALU" | "STACK" | "PC" | "NONE";
  involvedRegisters: string[];
  memoryAddress?: number;
  memoryOldValue?: number;
  memoryNewValue?: number;
  branch?: BranchAnalysis;
  ccrExplanations: Array<{
    flag: string;
    from: number;
    to: number;
    reason: string;
  }>;
}

function hexWord(val: number): string {
  return (val & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function hexByte(val: number): string {
  return (val & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

export function analyzeInstructionSemantics(
  lastStep: LastStep | null,
  snapshot: CpuSnapshot | null,
): InstructionSemantic | null {
  if (!lastStep) return null;

  const mnem = lastStep.mnemonic.toUpperCase();
  const regChanges = lastStep.registers;
  const ccrChanges = lastStep.ccr;
  const writes = lastStep.writes;
  const pcBefore = lastStep.pcBefore;
  const pcAfter = lastStep.pcAfter;
  const bytesCount = lastStep.bytes.length;
  const fallthroughPc = (pcBefore + bytesCount) & 0xffff;

  const involvedRegisters = Array.from(
    new Set(regChanges.map((r) => r.name.toUpperCase())),
  );

  // CCR Explanations
  const ccrExplanations = ccrChanges.map((c) => {
    const flag = c.name.toUpperCase();
    const from = c.from;
    const to = c.to;
    let reason = `Bandera ${flag} cambió a ${to}`;

    if (flag === "Z") {
      reason =
        to === 1
          ? "El resultado de la operación fue cero (Z=1)"
          : "El resultado fue distinto de cero (Z=0)";
    } else if (flag === "N") {
      reason =
        to === 1
          ? "El bit más significativo (signo) es 1 (resultado negativo, N=1)"
          : "El bit de signo es 0 (resultado positivo o cero, N=0)";
    } else if (flag === "C") {
      reason =
        to === 1
          ? "Se produjo acarreo (carry) o préstamo en la operación (C=1)"
          : "Sin acarreo ni préstamo (C=0)";
    } else if (flag === "V") {
      reason =
        to === 1
          ? "Se produjo desbordamiento aritmético en complemento a 2 (V=1)"
          : "Sin desbordamiento aritmético (V=0)";
    } else if (flag === "H") {
      reason =
        to === 1
          ? "Acarreo de medio byte (bits 3 a 4) en suma binaria (H=1)"
          : "Sin acarreo de medio byte (H=0)";
    } else if (flag === "I") {
      reason =
        to === 1
          ? "Interrupciones enmascarables deshabilitadas (I=1)"
          : "Interrupciones enmascarables habilitadas (I=0)";
    }

    return { flag, from, to, reason };
  });

  // Branch analysis
  const isBranchMnem = [
    "BRA",
    "BEQ",
    "BNE",
    "BCC",
    "BCS",
    "BMI",
    "BPL",
    "BHI",
    "BLS",
    "BGE",
    "BLT",
    "BGT",
    "BLE",
    "BRSET",
    "BRCLR",
  ].includes(mnem);

  let branch: BranchAnalysis | undefined;
  if (isBranchMnem) {
    const taken = pcAfter !== fallthroughPc;
    let condition = "Incondicional";

    if (mnem === "BEQ") condition = "Z == 1 (Igual / Cero)";
    else if (mnem === "BNE") condition = "Z == 0 (Distinto / No Cero)";
    else if (mnem === "BCC")
      condition = "C == 0 (Sin Acarreo / Mayor o Igual sin signo)";
    else if (mnem === "BCS")
      condition = "C == 1 (Con Acarreo / Menor sin signo)";
    else if (mnem === "BMI") condition = "N == 1 (Negativo / Menor que cero)";
    else if (mnem === "BPL") condition = "N == 0 (Positivo o Cero)";
    else if (mnem === "BHI") condition = "C == 0 y Z == 0 (Mayor sin signo)";
    else if (mnem === "BLS")
      condition = "C == 1 o Z == 1 (Menor o Igual sin signo)";
    else if (mnem === "BGE") condition = "N == V (Mayor o Igual con signo)";
    else if (mnem === "BLT") condition = "N != V (Menor con signo)";
    else if (mnem === "BGT") condition = "Z == 0 y N == V (Mayor con signo)";
    else if (mnem === "BLE")
      condition = "Z == 1 o N != V (Menor o Igual con signo)";
    else if (mnem === "BRSET")
      condition = "Bits de máscara encendidos en memoria";
    else if (mnem === "BRCLR")
      condition = "Bits de máscara apagados en memoria";

    branch = {
      isBranch: true,
      condition,
      taken,
      targetAddress: pcAfter,
      fallthroughAddress: fallthroughPc,
    };
  }

  // Identify Category & Generate Explanations
  if (mnem.startsWith("LD")) {
    const reg = mnem.slice(2);
    const changed = regChanges.find((r) => r.name.toUpperCase() === reg);
    const valHex = changed ? hexWord(changed.to) : "??";
    return {
      mnemonic: mnem,
      category: "LOAD",
      categoryLabel: "Carga de Registro",
      summary: `Cargó el registro ${reg} con el valor $${valHex}.`,
      detail: `La CPU leyó los datos correspondientes desde la memoria o valor inmediato y los depositó en el registro ${reg}.`,
      sourceBlock: "MEMORY",
      destBlock: "REGISTER",
      involvedRegisters: [reg, ...involvedRegisters],
      memoryAddress: writes[0]?.address,
      branch,
      ccrExplanations,
    };
  }

  if (mnem.startsWith("ST")) {
    const reg = mnem.slice(2);
    const w = writes[0];
    const addrHex = w ? hexWord(w.address) : "memoria";
    const valHex = w ? hexByte(w.new) : "??";
    return {
      mnemonic: mnem,
      category: "STORE",
      categoryLabel: "Almacenamiento en Memoria",
      summary: `Escribió el contenido de ${reg} ($${valHex}) en [${addrHex}].`,
      detail: `La CPU envió el dato almacenado en el registro ${reg} a través del bus de datos hacia la dirección física $${addrHex}.`,
      sourceBlock: "REGISTER",
      destBlock: "MEMORY",
      involvedRegisters: [reg, ...involvedRegisters],
      memoryAddress: w?.address,
      memoryOldValue: w?.old,
      memoryNewValue: w?.new,
      branch,
      ccrExplanations,
    };
  }

  if (mnem === "JSR" || mnem === "BSR") {
    return {
      mnemonic: mnem,
      category: "CALL",
      categoryLabel: "Llamada a Subrutina",
      summary: `Saltó a la subrutina en $${hexWord(pcAfter)} y guardó retorno en pila.`,
      detail: `La CPU apiló la dirección de retorno $${hexWord(fallthroughPc)} en la memoria de pila (SP actual: $${hexWord(snapshot?.sp ?? 0)}) y transfirió el control a $${hexWord(pcAfter)}.`,
      sourceBlock: "PC",
      destBlock: "STACK",
      involvedRegisters: ["SP", "PC", ...involvedRegisters],
      memoryAddress: writes[0]?.address,
      branch,
      ccrExplanations,
    };
  }

  if (mnem === "RTS") {
    return {
      mnemonic: mnem,
      category: "RETURN",
      categoryLabel: "Retorno de Subrutina",
      summary: `Retornó de la subrutina a la dirección $${hexWord(pcAfter)}.`,
      detail: `La CPU desapiló la dirección de retorno guardada en el Stack (recuperando PC=$${hexWord(pcAfter)}) y liberó 2 bytes de la pila.`,
      sourceBlock: "STACK",
      destBlock: "PC",
      involvedRegisters: ["SP", "PC", ...involvedRegisters],
      branch,
      ccrExplanations,
    };
  }

  if (mnem === "JMP") {
    return {
      mnemonic: mnem,
      category: "JUMP",
      categoryLabel: "Salto Incondicional",
      summary: `Salto incondicional a la dirección $${hexWord(pcAfter)}.`,
      detail: `El contador de programa (PC) se actualizó directamente a $${hexWord(pcAfter)} sin alterar la pila.`,
      sourceBlock: "MEMORY",
      destBlock: "PC",
      involvedRegisters: ["PC", ...involvedRegisters],
      branch,
      ccrExplanations,
    };
  }

  if (isBranchMnem) {
    const isTaken = branch?.taken ?? false;
    return {
      mnemonic: mnem,
      category: "BRANCH",
      categoryLabel: isTaken ? "Bifurcación Tomada" : "Bifurcación No Tomada",
      summary: isTaken
        ? `Bifurcación cumplida (${branch?.condition}): saltó a $${hexWord(pcAfter)}.`
        : `Bifurcación no cumplida (${branch?.condition}): continuó en $${hexWord(pcAfter)}.`,
      detail: isTaken
        ? `La condición evaluada en el registro de banderas CCR resultó VERDADERA. El PC se desplazó hacia el destino $${hexWord(pcAfter)}.`
        : `La condición evaluada en el CCR resultó FALSA. La ejecución continuó en la instrucción inmediata siguiente ($${hexWord(pcAfter)}).`,
      sourceBlock: "ALU",
      destBlock: "PC",
      involvedRegisters: ["PC", ...involvedRegisters],
      branch,
      ccrExplanations,
    };
  }

  if (mnem.startsWith("PSH")) {
    const reg = mnem.slice(3);
    return {
      mnemonic: mnem,
      category: "STACK",
      categoryLabel: "Apilado de Registro (PUSH)",
      summary: `Apiló el registro ${reg} en la memoria de la pila.`,
      detail: `El dato del registro ${reg} se escribió en la posición apuntada por SP, decrementando el puntero de pila.`,
      sourceBlock: "REGISTER",
      destBlock: "STACK",
      involvedRegisters: [reg, "SP", ...involvedRegisters],
      memoryAddress: writes[0]?.address,
      memoryNewValue: writes[0]?.new,
      branch,
      ccrExplanations,
    };
  }

  if (mnem.startsWith("PUL")) {
    const reg = mnem.slice(3);
    return {
      mnemonic: mnem,
      category: "STACK",
      categoryLabel: "Desapilado de Registro (PULL)",
      summary: `Recuperó el registro ${reg} desde el tope de la pila.`,
      detail: `La CPU incrementó SP y leyó el valor almacenado en la pila, cargándolo en ${reg}.`,
      sourceBlock: "STACK",
      destBlock: "REGISTER",
      involvedRegisters: [reg, "SP", ...involvedRegisters],
      branch,
      ccrExplanations,
    };
  }

  if (
    mnem.startsWith("INC") ||
    mnem.startsWith("DEC") ||
    mnem === "INX" ||
    mnem === "DEX" ||
    mnem === "INY" ||
    mnem === "DEY" ||
    mnem === "INS" ||
    mnem === "DES"
  ) {
    const isInc = mnem.startsWith("IN");
    const target = mnem.replace(/^(INC|DEC|IN|DE)/, "") || "Memoria";
    const w = writes[0];
    return {
      mnemonic: mnem,
      category: "ALU",
      categoryLabel: isInc ? "Incremento (+1)" : "Decremento (-1)",
      summary: w
        ? `${isInc ? "Incrementó" : "Decrementó"} [$${hexWord(w.address)}]: $${hexByte(w.old)} → $${hexByte(w.new)}.`
        : `${isInc ? "Incrementó" : "Decrementó"} el valor de ${target || "registro"}.`,
      detail: `La ALU realizó la operación de ${isInc ? "adición (+1)" : "sustracción (-1)"}, actualizando el resultado y las banderas de condición correspondientes.`,
      sourceBlock: w ? "MEMORY" : "REGISTER",
      destBlock: w ? "MEMORY" : "REGISTER",
      involvedRegisters,
      memoryAddress: w?.address,
      memoryOldValue: w?.old,
      memoryNewValue: w?.new,
      branch,
      ccrExplanations,
    };
  }

  if (
    mnem.startsWith("ADD") ||
    mnem.startsWith("SUB") ||
    mnem === "ABA" ||
    mnem === "SBA" ||
    mnem === "MUL"
  ) {
    const isAdd = mnem.startsWith("ADD") || mnem === "ABA";
    const isMul = mnem === "MUL";
    return {
      mnemonic: mnem,
      category: "ALU",
      categoryLabel: isMul
        ? "Multiplicación"
        : isAdd
          ? "Suma Aritmética"
          : "Resta Aritmética",
      summary: isMul
        ? `Multiplicó A × B y almacenó el resultado de 16 bits en D ($${hexWord(snapshot?.d ?? 0)}).`
        : `Ejecutó operación aritmética ${mnem} a través de la ALU.`,
      detail: `La Unidad Aritmético-Lógica (ALU) operó con los operandos y actualizó el acumulador destino junto con las banderas de desbordamiento, signo, cero y acarreo.`,
      sourceBlock: "ALU",
      destBlock: "REGISTER",
      involvedRegisters,
      branch,
      ccrExplanations,
    };
  }

  if (
    mnem.startsWith("CMP") ||
    mnem.startsWith("CP") ||
    mnem === "CBA" ||
    mnem.startsWith("TST") ||
    mnem.startsWith("BIT")
  ) {
    return {
      mnemonic: mnem,
      category: "ALU",
      categoryLabel: "Comparación / Prueba",
      summary: `Comparó operandos (${mnem}) sin modificar registros de datos.`,
      detail: `La ALU realizó una resta o prueba lógica temporal exclusivamente para actualizar las banderas del registro CCR (N, Z, V, C) que gobernarán las próximas bifurcaciones.`,
      sourceBlock: "REGISTER",
      destBlock: "ALU",
      involvedRegisters,
      branch,
      ccrExplanations,
    };
  }

  if (mnem.startsWith("CLR")) {
    const w = writes[0];
    return {
      mnemonic: mnem,
      category: "ALU",
      categoryLabel: "Borrado a Cero (CLEAR)",
      summary: w
        ? `Puso a cero la posición de memoria [$${hexWord(w.address)}].`
        : `Puso a cero el acumulador correspondiente.`,
      detail: `Se forzó el valor a $00, activando la bandera Z=1 y limpiando N=0, V=0, C=0.`,
      sourceBlock: "ALU",
      destBlock: w ? "MEMORY" : "REGISTER",
      involvedRegisters,
      memoryAddress: w?.address,
      memoryOldValue: w?.old,
      memoryNewValue: 0,
      branch,
      ccrExplanations,
    };
  }

  if (
    mnem.startsWith("ASL") ||
    mnem.startsWith("ASR") ||
    mnem.startsWith("LSR") ||
    mnem.startsWith("ROL") ||
    mnem.startsWith("ROR")
  ) {
    const w = writes[0];
    return {
      mnemonic: mnem,
      category: "ALU",
      categoryLabel: "Desplazamiento / Rotación de Bits",
      summary: `Desplazó los bits de ${w ? `[$${hexWord(w.address)}]` : "acumulador"}.`,
      detail: `La ALU rotó o desplazó los bits a través del acarreo (flag C), modificando la representación binaria del valor.`,
      sourceBlock: w ? "MEMORY" : "REGISTER",
      destBlock: w ? "MEMORY" : "REGISTER",
      involvedRegisters,
      memoryAddress: w?.address,
      memoryOldValue: w?.old,
      memoryNewValue: w?.new,
      branch,
      ccrExplanations,
    };
  }

  if (
    mnem === "TSX" ||
    mnem === "TXS" ||
    mnem === "TSY" ||
    mnem === "TYS" ||
    mnem === "TAB" ||
    mnem === "TBA" ||
    mnem === "XGDX" ||
    mnem === "XGDY"
  ) {
    return {
      mnemonic: mnem,
      category: "TRANSFER",
      categoryLabel: "Transferencia entre Registros",
      summary: `Transfirió datos entre registros (${mnem}).`,
      detail: `Se copió o intercambió el valor de forma directa entre registros internos de la CPU sin pasar por la memoria externa.`,
      sourceBlock: "REGISTER",
      destBlock: "REGISTER",
      involvedRegisters,
      branch,
      ccrExplanations,
    };
  }

  // Fallback generic explanation
  return {
    mnemonic: mnem,
    category: "SYSTEM",
    categoryLabel: "Operación de CPU",
    summary: `Ejecución de instrucción ${mnem} (+${lastStep.cyclesAdded} ciclos).`,
    detail: `La CPU ejecutó el opcode $${hexByte(lastStep.opcode)} y avanzó el contador de programa de $${hexWord(pcBefore)} a $${hexWord(pcAfter)}.`,
    sourceBlock: "NONE",
    destBlock: "NONE",
    involvedRegisters,
    memoryAddress: writes[0]?.address,
    memoryOldValue: writes[0]?.old,
    memoryNewValue: writes[0]?.new,
    branch,
    ccrExplanations,
  };
}
