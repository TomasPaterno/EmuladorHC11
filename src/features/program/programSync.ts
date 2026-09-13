/**
 * Utilidades para sincronización bidireccional entre la memoria del emulador
 * y el contenido del programa (listados .lst / texto y registros Motorola S19).
 */

export interface ParsedCodeLine {
  lineIndex: number;
  raw: string;
  address: number | null;
  bytes: string[];
  rest: string;
  isS19: boolean;
}

/**
 * Recalcula la suma de comprobación (checksum) de un registro Motorola S1.
 * Formato S1: S1<count 2><addr 4><data ...><checksum 2>
 * El checksum es el complemento a 1 de la suma de los bytes (count + addr + data).
 */
export function recalculateS1Checksum(s1Line: string): string {
  const trimmed = s1Line.trim();
  if (!trimmed.toUpperCase().startsWith("S1") || trimmed.length < 8) {
    return s1Line;
  }
  const count = parseInt(trimmed.substring(2, 4), 16);
  if (Number.isNaN(count) || count < 3) return s1Line;

  const dataCharLength = (count - 3) * 2;
  const contentToSum = trimmed.substring(2, 8 + dataCharLength);

  let sum = 0;
  for (let i = 0; i < contentToSum.length; i += 2) {
    const byteVal = parseInt(contentToSum.substring(i, i + 2), 16);
    if (!Number.isNaN(byteVal)) {
      sum += byteVal;
    }
  }

  const checksum = (~sum & 0xff).toString(16).toUpperCase().padStart(2, "0");
  return trimmed.substring(0, 8 + dataCharLength) + checksum;
}

/**
 * Parsea una línea de listado o registro S19 identificando dirección, bytes y texto.
 */
export function parseCodeLine(line: string, index: number): ParsedCodeLine {
  const trimmed = line.trim();
  if (!trimmed) {
    return {
      lineIndex: index,
      raw: line,
      address: null,
      bytes: [],
      rest: "",
      isS19: false,
    };
  }

  // Comprobar si es un registro S1 de Motorola S19
  if (/^S1[0-9A-Fa-f]{6,}/i.test(trimmed)) {
    const count = parseInt(trimmed.substring(2, 4), 16);
    const addr = parseInt(trimmed.substring(4, 8), 16);
    const dataBytesCount = Math.max(0, count - 3);
    const bytes: string[] = [];
    for (
      let i = 0;
      i < dataBytesCount && 8 + i * 2 + 2 <= trimmed.length;
      i++
    ) {
      bytes.push(trimmed.substring(8 + i * 2, 8 + i * 2 + 2).toUpperCase());
    }
    return {
      lineIndex: index,
      raw: line,
      address: Number.isNaN(addr) ? null : addr,
      bytes,
      rest: "",
      isS19: true,
    };
  }

  // Patrón listado: "1 2000 86 08" o "2000 86 08"
  const tokens = trimmed.split(/\s+/);
  let addr: number | null = null;
  const bytes: string[] = [];
  let restStartIndex = 0;

  if (
    tokens.length >= 2 &&
    /^\d+$/.test(tokens[0]) &&
    /^[0-9a-fA-F]{4}$/.test(tokens[1])
  ) {
    addr = parseInt(tokens[1], 16);
    let i = 2;
    while (i < tokens.length && /^[0-9a-fA-F]{2}$/.test(tokens[i])) {
      bytes.push(tokens[i].toUpperCase());
      i++;
    }
    restStartIndex = i;
  } else if (/^[0-9a-fA-F]{4}$/.test(tokens[0])) {
    addr = parseInt(tokens[0], 16);
    let i = 1;
    while (i < tokens.length && /^[0-9a-fA-F]{2}$/.test(tokens[i])) {
      bytes.push(tokens[i].toUpperCase());
      i++;
    }
    restStartIndex = i;
  }

  const rest = tokens.slice(restStartIndex).join(" ");
  return {
    lineIndex: index,
    raw: line,
    address: addr !== null && !Number.isNaN(addr) ? addr : null,
    bytes,
    rest,
    isS19: false,
  };
}

/**
 * Actualiza un byte en el contenido del programa si la dirección coincide con una línea de código.
 * Retorna el nuevo texto del programa si hubo coincidencia, o null si la dirección no pertenece al código.
 */
export function updateProgramByte(
  content: string,
  targetAddress: number,
  newByteValue: number,
): string | null {
  const lines = content.split(/\r?\n/);
  const newByteHex = (newByteValue & 0xff)
    .toString(16)
    .toUpperCase()
    .padStart(2, "0");
  let found = false;

  const updatedLines = lines.map((line, idx) => {
    const parsed = parseCodeLine(line, idx);
    if (parsed.address === null || parsed.bytes.length === 0) {
      return line;
    }

    const startAddr = parsed.address;
    const endAddr = startAddr + parsed.bytes.length;
    if (targetAddress < startAddr || targetAddress >= endAddr) {
      return line;
    }

    const byteOffset = targetAddress - startAddr;
    if (parsed.bytes[byteOffset] === newByteHex) {
      // Ya tiene el mismo valor
      found = true;
      return line;
    }

    found = true;

    // Caso 1: Registro S1
    if (parsed.isS19) {
      const charOffset = 8 + byteOffset * 2;
      const prefix = line.substring(0, charOffset);
      const suffix = line.substring(charOffset + 2);
      const modifiedLine = prefix + newByteHex + suffix;
      return recalculateS1Checksum(modifiedLine);
    }

    // Caso 2: Línea de listado
    // Reemplazar de forma precisa el token de byte correspondiente
    // Buscar la posición de la dirección en la línea
    const addrHex = startAddr.toString(16).toUpperCase().padStart(4, "0");
    const addrPos = line.toUpperCase().indexOf(addrHex);
    if (addrPos === -1) {
      return line;
    }

    // A partir de addrPos + 4, buscar los tokens de bytes
    const afterAddr = line.substring(addrPos + 4);
    // Encontrar el byteOffset-ésimo byte hex
    const byteRegex = /\b([0-9A-Fa-f]{2})\b/g;
    let currentMatchIndex = 0;
    let targetMatchStart = -1;

    for (const match of afterAddr.matchAll(byteRegex)) {
      if (currentMatchIndex === byteOffset) {
        targetMatchStart = addrPos + 4 + match.index;
        break;
      }
      currentMatchIndex++;
    }

    if (targetMatchStart !== -1) {
      return (
        line.substring(0, targetMatchStart) +
        newByteHex +
        line.substring(targetMatchStart + 2)
      );
    }

    return line;
  });

  return found ? updatedLines.join("\n") : null;
}

/**
 * Actualiza los bytes completos de una línea en el contenido del programa.
 */
export function updateProgramLineBytes(
  content: string,
  lineIndex: number,
  newHexBytes: string[],
): {
  updatedContent: string;
  writes: { address: number; value: number }[];
} | null {
  const lines = content.split(/\r?\n/);
  if (lineIndex < 0 || lineIndex >= lines.length) return null;

  const targetLine = lines[lineIndex];
  const parsed = parseCodeLine(targetLine, lineIndex);
  if (parsed.address === null) return null;

  const writes: { address: number; value: number }[] = [];
  const validHexBytes: string[] = [];

  for (let i = 0; i < newHexBytes.length; i++) {
    const val = parseInt(newHexBytes[i], 16);
    if (!Number.isNaN(val)) {
      const cleanHex = (val & 0xff).toString(16).toUpperCase().padStart(2, "0");
      validHexBytes.push(cleanHex);
      writes.push({ address: parsed.address + i, value: val & 0xff });
    }
  }

  if (validHexBytes.length === 0) return null;

  if (parsed.isS19) {
    // Para S19, actualizar los bytes y recalcular
    const prefix = targetLine.substring(0, 8);
    const updatedLine = prefix + validHexBytes.join("");
    lines[lineIndex] = recalculateS1Checksum(updatedLine);
  } else {
    // Para listado: reconstruir tokens
    const tokens = targetLine.trim().split(/\s+/);
    if (/^\d+$/.test(tokens[0])) {
      // Línea numerada: "1 2000 [bytes...] [rest...]"
      const lineNum = tokens[0];
      const addrStr = tokens[1];
      const newLine = `${lineNum} ${addrStr} ${validHexBytes.join(" ")}${parsed.rest ? " " + parsed.rest : ""}`;
      lines[lineIndex] = newLine;
    } else {
      // "2000 [bytes...] [rest...]"
      const addrStr = tokens[0];
      const newLine = `${addrStr} ${validHexBytes.join(" ")}${parsed.rest ? " " + parsed.rest : ""}`;
      lines[lineIndex] = newLine;
    }
  }

  return {
    updatedContent: lines.join("\n"),
    writes,
  };
}

/**
 * Actualiza el texto de instrucción / comentario de una línea de código.
 */
export function updateProgramLineText(
  content: string,
  lineIndex: number,
  newText: string,
): string {
  const lines = content.split(/\r?\n/);
  if (lineIndex < 0 || lineIndex >= lines.length) return content;

  const targetLine = lines[lineIndex];
  const parsed = parseCodeLine(targetLine, lineIndex);

  if (parsed.address === null) {
    lines[lineIndex] = newText;
    return lines.join("\n");
  }

  if (parsed.isS19) {
    lines[lineIndex] = newText;
    return lines.join("\n");
  }

  const tokens = targetLine.trim().split(/\s+/);
  if (/^\d+$/.test(tokens[0])) {
    const lineNum = tokens[0];
    const addrStr = tokens[1];
    const bytesStr = parsed.bytes.join(" ");
    lines[lineIndex] =
      `${lineNum} ${addrStr} ${bytesStr}${newText ? "  " + newText.trim() : ""}`;
  } else {
    const addrStr = tokens[0];
    const bytesStr = parsed.bytes.join(" ");
    lines[lineIndex] =
      `${addrStr} ${bytesStr}${newText ? "  " + newText.trim() : ""}`;
  }

  return lines.join("\n");
}

/**
 * Actualiza la dirección base de una línea de código.
 */
export function updateProgramLineAddress(
  content: string,
  lineIndex: number,
  newAddress: number,
): string {
  const lines = content.split(/\r?\n/);
  if (lineIndex < 0 || lineIndex >= lines.length) return content;

  const targetLine = lines[lineIndex];
  const parsed = parseCodeLine(targetLine, lineIndex);
  if (parsed.address === null) return content;

  const newAddrHex = (newAddress & 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");

  if (parsed.isS19) {
    const prefix = targetLine.substring(0, 4);
    const rest = targetLine.substring(8);
    const updatedLine = prefix + newAddrHex + rest;
    lines[lineIndex] = recalculateS1Checksum(updatedLine);
    return lines.join("\n");
  }

  const tokens = targetLine.trim().split(/\s+/);
  if (/^\d+$/.test(tokens[0])) {
    tokens[1] = newAddrHex;
  } else {
    tokens[0] = newAddrHex;
  }
  lines[lineIndex] = tokens.join(" ");
  return lines.join("\n");
}
