/**
 * Desensamblador para Motorola 68HC11.
 * Mapeo canónico según E5 Tabla 4-2 (Manual de Referencia Motorola 68HC11).
 * Soporta páginas 0, $18, $1A y $CD y todos los modos de direccionamiento.
 */

export type AddressingMode =
  | "INH" // Inherente (0 parámetros)
  | "IMM" // Inmediato 8 bits (1 parámetro: #$XX)
  | "IMM16" // Inmediato 16 bits (2 parámetros: #$XXXX)
  | "DIR" // Directo (1 parámetro: $XX)
  | "EXT" // Extendido (2 parámetros: $XXXX)
  | "INDX" // Indexado X (1 parámetro: $XX,X)
  | "INDY" // Indexado Y (1 parámetro: $XX,Y)
  | "REL" // Relativo de salto (1 parámetro: destino calculado)
  | "BSET_DIR" // Bit set directo (2 parámetros: $dir, $mask)
  | "BSET_INDX" // Bit set indexado X (2 parámetros: $offset,X, $mask)
  | "BSET_INDY" // Bit set indexado Y (2 parámetros: $offset,Y, $mask)
  | "BRSET_DIR" // Branch set directo (3 parámetros: $dir, $mask, $rel)
  | "BRSET_INDX" // Branch set indexado X (3 parámetros: $offset,X, $mask, $rel)
  | "BRSET_INDY"; // Branch set indexado Y (3 parámetros: $offset,Y, $mask, $rel)

export interface InstructionDef {
  mnemonic: string;
  mode: AddressingMode;
  totalBytes: number;
  paramBytes: number; // Cantidad de bytes de parámetros esperados (0, 1, 2 o 3)
}

export interface DisassemblyResult {
  mnemonic: string;
  operands: string;
  formatted: string; // Ej: "LDAA #$08"
  mode: AddressingMode | "RAW";
  opcodeBytesCount: number; // 1 o 2 (si hubo prefijo)
  expectedParamBytes: number; // 0..3
  actualParamBytes: number;
  isComplete: boolean;
  rawHex: string[];
}

/**
 * Máximo número de parámetros permitido en cualquier instrucción del 68HC11 (BRSET/BRCLR usa 3).
 */
export const MAX_INSTRUCTION_PARAMS = 3;

function hexByte(val: number): string {
  return (val & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

function hexWord(val: number): string {
  return (val & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

// Tabla de página 0
const PAGE_0: Record<
  number,
  { mnemonic: string; mode: AddressingMode; totalBytes: number }
> = {
  0x01: { mnemonic: "NOP", mode: "INH", totalBytes: 1 },
  0x04: { mnemonic: "LSRD", mode: "INH", totalBytes: 1 },
  0x05: { mnemonic: "ASLD", mode: "INH", totalBytes: 1 },
  0x06: { mnemonic: "TAP", mode: "INH", totalBytes: 1 },
  0x07: { mnemonic: "TPA", mode: "INH", totalBytes: 1 },
  0x08: { mnemonic: "INX", mode: "INH", totalBytes: 1 },
  0x09: { mnemonic: "DEX", mode: "INH", totalBytes: 1 },
  0x0a: { mnemonic: "CLV", mode: "INH", totalBytes: 1 },
  0x0b: { mnemonic: "SEV", mode: "INH", totalBytes: 1 },
  0x0c: { mnemonic: "CLC", mode: "INH", totalBytes: 1 },
  0x0d: { mnemonic: "SEC", mode: "INH", totalBytes: 1 },
  0x0e: { mnemonic: "CLI", mode: "INH", totalBytes: 1 },
  0x0f: { mnemonic: "SEI", mode: "INH", totalBytes: 1 },
  0x10: { mnemonic: "SBA", mode: "INH", totalBytes: 1 },
  0x11: { mnemonic: "CBA", mode: "INH", totalBytes: 1 },
  0x12: { mnemonic: "BRSET", mode: "BRSET_DIR", totalBytes: 4 },
  0x13: { mnemonic: "BRCLR", mode: "BRSET_DIR", totalBytes: 4 },
  0x14: { mnemonic: "BSET", mode: "BSET_DIR", totalBytes: 3 },
  0x15: { mnemonic: "BCLR", mode: "BSET_DIR", totalBytes: 3 },
  0x16: { mnemonic: "TAB", mode: "INH", totalBytes: 1 },
  0x17: { mnemonic: "TBA", mode: "INH", totalBytes: 1 },
  0x1b: { mnemonic: "ABA", mode: "INH", totalBytes: 1 },
  0x1c: { mnemonic: "BSET", mode: "BSET_INDX", totalBytes: 3 },
  0x1d: { mnemonic: "BCLR", mode: "BSET_INDX", totalBytes: 3 },
  0x1e: { mnemonic: "BRSET", mode: "BRSET_INDX", totalBytes: 4 },
  0x1f: { mnemonic: "BRCLR", mode: "BRSET_INDX", totalBytes: 4 },
  0x20: { mnemonic: "BRA", mode: "REL", totalBytes: 2 },
  0x22: { mnemonic: "BHI", mode: "REL", totalBytes: 2 },
  0x23: { mnemonic: "BLS", mode: "REL", totalBytes: 2 },
  0x24: { mnemonic: "BCC", mode: "REL", totalBytes: 2 },
  0x25: { mnemonic: "BCS", mode: "REL", totalBytes: 2 },
  0x26: { mnemonic: "BNE", mode: "REL", totalBytes: 2 },
  0x27: { mnemonic: "BEQ", mode: "REL", totalBytes: 2 },
  0x2a: { mnemonic: "BPL", mode: "REL", totalBytes: 2 },
  0x2b: { mnemonic: "BMI", mode: "REL", totalBytes: 2 },
  0x2c: { mnemonic: "BGE", mode: "REL", totalBytes: 2 },
  0x2d: { mnemonic: "BLT", mode: "REL", totalBytes: 2 },
  0x2e: { mnemonic: "BGT", mode: "REL", totalBytes: 2 },
  0x2f: { mnemonic: "BLE", mode: "REL", totalBytes: 2 },
  0x30: { mnemonic: "TSX", mode: "INH", totalBytes: 1 },
  0x31: { mnemonic: "INS", mode: "INH", totalBytes: 1 },
  0x32: { mnemonic: "PULA", mode: "INH", totalBytes: 1 },
  0x33: { mnemonic: "PULB", mode: "INH", totalBytes: 1 },
  0x34: { mnemonic: "DES", mode: "INH", totalBytes: 1 },
  0x35: { mnemonic: "TXS", mode: "INH", totalBytes: 1 },
  0x36: { mnemonic: "PSHA", mode: "INH", totalBytes: 1 },
  0x37: { mnemonic: "PSHB", mode: "INH", totalBytes: 1 },
  0x38: { mnemonic: "PULX", mode: "INH", totalBytes: 1 },
  0x39: { mnemonic: "RTS", mode: "INH", totalBytes: 1 },
  0x3a: { mnemonic: "ABX", mode: "INH", totalBytes: 1 },
  0x3c: { mnemonic: "PSHX", mode: "INH", totalBytes: 1 },
  0x3d: { mnemonic: "MUL", mode: "INH", totalBytes: 1 },
  0x40: { mnemonic: "NEGA", mode: "INH", totalBytes: 1 },
  0x43: { mnemonic: "COMA", mode: "INH", totalBytes: 1 },
  0x44: { mnemonic: "LSRA", mode: "INH", totalBytes: 1 },
  0x46: { mnemonic: "RORA", mode: "INH", totalBytes: 1 },
  0x47: { mnemonic: "ASRA", mode: "INH", totalBytes: 1 },
  0x48: { mnemonic: "ASLA", mode: "INH", totalBytes: 1 },
  0x49: { mnemonic: "ROLA", mode: "INH", totalBytes: 1 },
  0x4a: { mnemonic: "DECA", mode: "INH", totalBytes: 1 },
  0x4c: { mnemonic: "INCA", mode: "INH", totalBytes: 1 },
  0x4d: { mnemonic: "TSTA", mode: "INH", totalBytes: 1 },
  0x4f: { mnemonic: "CLRA", mode: "INH", totalBytes: 1 },
  0x50: { mnemonic: "NEGB", mode: "INH", totalBytes: 1 },
  0x53: { mnemonic: "COMB", mode: "INH", totalBytes: 1 },
  0x54: { mnemonic: "LSRB", mode: "INH", totalBytes: 1 },
  0x56: { mnemonic: "RORB", mode: "INH", totalBytes: 1 },
  0x57: { mnemonic: "ASRB", mode: "INH", totalBytes: 1 },
  0x58: { mnemonic: "ASLB", mode: "INH", totalBytes: 1 },
  0x59: { mnemonic: "ROLB", mode: "INH", totalBytes: 1 },
  0x5a: { mnemonic: "DECB", mode: "INH", totalBytes: 1 },
  0x5c: { mnemonic: "INCB", mode: "INH", totalBytes: 1 },
  0x5d: { mnemonic: "TSTB", mode: "INH", totalBytes: 1 },
  0x5f: { mnemonic: "CLRB", mode: "INH", totalBytes: 1 },

  // $60..$6F: INDX (2 bytes)
  0x60: { mnemonic: "NEG", mode: "INDX", totalBytes: 2 },
  0x63: { mnemonic: "COM", mode: "INDX", totalBytes: 2 },
  0x64: { mnemonic: "LSR", mode: "INDX", totalBytes: 2 },
  0x66: { mnemonic: "ROR", mode: "INDX", totalBytes: 2 },
  0x67: { mnemonic: "ASR", mode: "INDX", totalBytes: 2 },
  0x68: { mnemonic: "ASL", mode: "INDX", totalBytes: 2 },
  0x69: { mnemonic: "ROL", mode: "INDX", totalBytes: 2 },
  0x6a: { mnemonic: "DEC", mode: "INDX", totalBytes: 2 },
  0x6c: { mnemonic: "INC", mode: "INDX", totalBytes: 2 },
  0x6d: { mnemonic: "TST", mode: "INDX", totalBytes: 2 },
  0x6e: { mnemonic: "JMP", mode: "INDX", totalBytes: 2 },
  0x6f: { mnemonic: "CLR", mode: "INDX", totalBytes: 2 },

  // $70..$7F: EXT (3 bytes)
  0x70: { mnemonic: "NEG", mode: "EXT", totalBytes: 3 },
  0x73: { mnemonic: "COM", mode: "EXT", totalBytes: 3 },
  0x74: { mnemonic: "LSR", mode: "EXT", totalBytes: 3 },
  0x76: { mnemonic: "ROR", mode: "EXT", totalBytes: 3 },
  0x77: { mnemonic: "ASR", mode: "EXT", totalBytes: 3 },
  0x78: { mnemonic: "ASL", mode: "EXT", totalBytes: 3 },
  0x79: { mnemonic: "ROL", mode: "EXT", totalBytes: 3 },
  0x7a: { mnemonic: "DEC", mode: "EXT", totalBytes: 3 },
  0x7c: { mnemonic: "INC", mode: "EXT", totalBytes: 3 },
  0x7d: { mnemonic: "TST", mode: "EXT", totalBytes: 3 },
  0x7e: { mnemonic: "JMP", mode: "EXT", totalBytes: 3 },
  0x7f: { mnemonic: "CLR", mode: "EXT", totalBytes: 3 },

  // $80..$8F: IMM / IMM16
  0x80: { mnemonic: "SUBA", mode: "IMM", totalBytes: 2 },
  0x81: { mnemonic: "CMPA", mode: "IMM", totalBytes: 2 },
  0x83: { mnemonic: "SUBD", mode: "IMM16", totalBytes: 3 },
  0x84: { mnemonic: "ANDA", mode: "IMM", totalBytes: 2 },
  0x85: { mnemonic: "BITA", mode: "IMM", totalBytes: 2 },
  0x86: { mnemonic: "LDAA", mode: "IMM", totalBytes: 2 },
  0x88: { mnemonic: "EORA", mode: "IMM", totalBytes: 2 },
  0x89: { mnemonic: "ADCA", mode: "IMM", totalBytes: 2 },
  0x8a: { mnemonic: "ORAA", mode: "IMM", totalBytes: 2 },
  0x8b: { mnemonic: "ADDA", mode: "IMM", totalBytes: 2 },
  0x8c: { mnemonic: "CPX", mode: "IMM16", totalBytes: 3 },
  0x8d: { mnemonic: "BSR", mode: "REL", totalBytes: 2 },
  0x8e: { mnemonic: "LDS", mode: "IMM16", totalBytes: 3 },
  0x8f: { mnemonic: "XGDX", mode: "INH", totalBytes: 1 },

  // $90..$9F: DIR (2 bytes)
  0x90: { mnemonic: "SUBA", mode: "DIR", totalBytes: 2 },
  0x91: { mnemonic: "CMPA", mode: "DIR", totalBytes: 2 },
  0x93: { mnemonic: "SUBD", mode: "DIR", totalBytes: 2 },
  0x94: { mnemonic: "ANDA", mode: "DIR", totalBytes: 2 },
  0x95: { mnemonic: "BITA", mode: "DIR", totalBytes: 2 },
  0x96: { mnemonic: "LDAA", mode: "DIR", totalBytes: 2 },
  0x97: { mnemonic: "STAA", mode: "DIR", totalBytes: 2 },
  0x98: { mnemonic: "EORA", mode: "DIR", totalBytes: 2 },
  0x99: { mnemonic: "ADCA", mode: "DIR", totalBytes: 2 },
  0x9a: { mnemonic: "ORAA", mode: "DIR", totalBytes: 2 },
  0x9b: { mnemonic: "ADDA", mode: "DIR", totalBytes: 2 },
  0x9c: { mnemonic: "CPX", mode: "DIR", totalBytes: 2 },
  0x9d: { mnemonic: "JSR", mode: "DIR", totalBytes: 2 },
  0x9e: { mnemonic: "LDS", mode: "DIR", totalBytes: 2 },
  0x9f: { mnemonic: "STS", mode: "DIR", totalBytes: 2 },

  // $A0..$AF: INDX (2 bytes)
  0xa0: { mnemonic: "SUBA", mode: "INDX", totalBytes: 2 },
  0xa1: { mnemonic: "CMPA", mode: "INDX", totalBytes: 2 },
  0xa3: { mnemonic: "SUBD", mode: "INDX", totalBytes: 2 },
  0xa4: { mnemonic: "ANDA", mode: "INDX", totalBytes: 2 },
  0xa5: { mnemonic: "BITA", mode: "INDX", totalBytes: 2 },
  0xa6: { mnemonic: "LDAA", mode: "INDX", totalBytes: 2 },
  0xa7: { mnemonic: "STAA", mode: "INDX", totalBytes: 2 },
  0xa8: { mnemonic: "EORA", mode: "INDX", totalBytes: 2 },
  0xa9: { mnemonic: "ADCA", mode: "INDX", totalBytes: 2 },
  0xaa: { mnemonic: "ORAA", mode: "INDX", totalBytes: 2 },
  0xab: { mnemonic: "ADDA", mode: "INDX", totalBytes: 2 },
  0xac: { mnemonic: "CPX", mode: "INDX", totalBytes: 2 },
  0xad: { mnemonic: "JSR", mode: "INDX", totalBytes: 2 },
  0xae: { mnemonic: "LDS", mode: "INDX", totalBytes: 2 },
  0xaf: { mnemonic: "STS", mode: "INDX", totalBytes: 2 },

  // $B0..$BF: EXT (3 bytes)
  0xb0: { mnemonic: "SUBA", mode: "EXT", totalBytes: 3 },
  0xb1: { mnemonic: "CMPA", mode: "EXT", totalBytes: 3 },
  0xb3: { mnemonic: "SUBD", mode: "EXT", totalBytes: 3 },
  0xb4: { mnemonic: "ANDA", mode: "EXT", totalBytes: 3 },
  0xb5: { mnemonic: "BITA", mode: "EXT", totalBytes: 3 },
  0xb6: { mnemonic: "LDAA", mode: "EXT", totalBytes: 3 },
  0xb7: { mnemonic: "STAA", mode: "EXT", totalBytes: 3 },
  0xb8: { mnemonic: "EORA", mode: "EXT", totalBytes: 3 },
  0xb9: { mnemonic: "ADCA", mode: "EXT", totalBytes: 3 },
  0xba: { mnemonic: "ORAA", mode: "EXT", totalBytes: 3 },
  0xbb: { mnemonic: "ADDA", mode: "EXT", totalBytes: 3 },
  0xbc: { mnemonic: "CPX", mode: "EXT", totalBytes: 3 },
  0xbd: { mnemonic: "JSR", mode: "EXT", totalBytes: 3 },
  0xbe: { mnemonic: "LDS", mode: "EXT", totalBytes: 3 },
  0xbf: { mnemonic: "STS", mode: "EXT", totalBytes: 3 },

  // $C0..$CF: IMM / IMM16
  0xc0: { mnemonic: "SUBB", mode: "IMM", totalBytes: 2 },
  0xc1: { mnemonic: "CMPB", mode: "IMM", totalBytes: 2 },
  0xc3: { mnemonic: "ADDD", mode: "IMM16", totalBytes: 3 },
  0xc4: { mnemonic: "ANDB", mode: "IMM", totalBytes: 2 },
  0xc5: { mnemonic: "BITB", mode: "IMM", totalBytes: 2 },
  0xc6: { mnemonic: "LDAB", mode: "IMM", totalBytes: 2 },
  0xc8: { mnemonic: "EORB", mode: "IMM", totalBytes: 2 },
  0xc9: { mnemonic: "ADCB", mode: "IMM", totalBytes: 2 },
  0xca: { mnemonic: "ORAB", mode: "IMM", totalBytes: 2 },
  0xcb: { mnemonic: "ADDB", mode: "IMM", totalBytes: 2 },
  0xcc: { mnemonic: "LDD", mode: "IMM16", totalBytes: 3 },
  0xce: { mnemonic: "LDX", mode: "IMM16", totalBytes: 3 },

  // $D0..$DF: DIR (2 bytes)
  0xd0: { mnemonic: "SUBB", mode: "DIR", totalBytes: 2 },
  0xd1: { mnemonic: "CMPB", mode: "DIR", totalBytes: 2 },
  0xd3: { mnemonic: "ADDD", mode: "DIR", totalBytes: 2 },
  0xd4: { mnemonic: "ANDB", mode: "DIR", totalBytes: 2 },
  0xd5: { mnemonic: "BITB", mode: "DIR", totalBytes: 2 },
  0xd6: { mnemonic: "LDAB", mode: "DIR", totalBytes: 2 },
  0xd7: { mnemonic: "STAB", mode: "DIR", totalBytes: 2 },
  0xd8: { mnemonic: "EORB", mode: "DIR", totalBytes: 2 },
  0xd9: { mnemonic: "ADCB", mode: "DIR", totalBytes: 2 },
  0xda: { mnemonic: "ORAB", mode: "DIR", totalBytes: 2 },
  0xdb: { mnemonic: "ADDB", mode: "DIR", totalBytes: 2 },
  0xdc: { mnemonic: "LDD", mode: "DIR", totalBytes: 2 },
  0xdd: { mnemonic: "STD", mode: "DIR", totalBytes: 2 },
  0xde: { mnemonic: "LDX", mode: "DIR", totalBytes: 2 },
  0xdf: { mnemonic: "STX", mode: "DIR", totalBytes: 2 },

  // $E0..$EF: INDX (2 bytes)
  0xe0: { mnemonic: "SUBB", mode: "INDX", totalBytes: 2 },
  0xe1: { mnemonic: "CMPB", mode: "INDX", totalBytes: 2 },
  0xe3: { mnemonic: "ADDD", mode: "INDX", totalBytes: 2 },
  0xe4: { mnemonic: "ANDB", mode: "INDX", totalBytes: 2 },
  0xe5: { mnemonic: "BITB", mode: "INDX", totalBytes: 2 },
  0xe6: { mnemonic: "LDAB", mode: "INDX", totalBytes: 2 },
  0xe7: { mnemonic: "STAB", mode: "INDX", totalBytes: 2 },
  0xe8: { mnemonic: "EORB", mode: "INDX", totalBytes: 2 },
  0xe9: { mnemonic: "ADCB", mode: "INDX", totalBytes: 2 },
  0xea: { mnemonic: "ORAB", mode: "INDX", totalBytes: 2 },
  0xeb: { mnemonic: "ADDB", mode: "INDX", totalBytes: 2 },
  0xec: { mnemonic: "LDD", mode: "INDX", totalBytes: 2 },
  0xed: { mnemonic: "STD", mode: "INDX", totalBytes: 2 },
  0xee: { mnemonic: "LDX", mode: "INDX", totalBytes: 2 },
  0xef: { mnemonic: "STX", mode: "INDX", totalBytes: 2 },

  // $F0..$FF: EXT (3 bytes)
  0xf0: { mnemonic: "SUBB", mode: "EXT", totalBytes: 3 },
  0xf1: { mnemonic: "CMPB", mode: "EXT", totalBytes: 3 },
  0xf3: { mnemonic: "ADDD", mode: "EXT", totalBytes: 3 },
  0xf4: { mnemonic: "ANDB", mode: "EXT", totalBytes: 3 },
  0xf5: { mnemonic: "BITB", mode: "EXT", totalBytes: 3 },
  0xf6: { mnemonic: "LDAB", mode: "EXT", totalBytes: 3 },
  0xf7: { mnemonic: "STAB", mode: "EXT", totalBytes: 3 },
  0xf8: { mnemonic: "EORB", mode: "EXT", totalBytes: 3 },
  0xf9: { mnemonic: "ADCB", mode: "EXT", totalBytes: 3 },
  0xfa: { mnemonic: "ORAB", mode: "EXT", totalBytes: 3 },
  0xfb: { mnemonic: "ADDB", mode: "EXT", totalBytes: 3 },
  0xfc: { mnemonic: "LDD", mode: "EXT", totalBytes: 3 },
  0xfd: { mnemonic: "STD", mode: "EXT", totalBytes: 3 },
  0xfe: { mnemonic: "LDX", mode: "EXT", totalBytes: 3 },
  0xff: { mnemonic: "STX", mode: "EXT", totalBytes: 3 },
};

// Tabla de página $18 (Prefijo 0x18)
const PAGE_18: Record<
  number,
  { mnemonic: string; mode: AddressingMode; totalBytes: number }
> = {
  0x08: { mnemonic: "INY", mode: "INH", totalBytes: 2 },
  0x09: { mnemonic: "DEY", mode: "INH", totalBytes: 2 },
  0x1c: { mnemonic: "BSET", mode: "BSET_INDY", totalBytes: 4 },
  0x1d: { mnemonic: "BCLR", mode: "BSET_INDY", totalBytes: 4 },
  0x1e: { mnemonic: "BRSET", mode: "BRSET_INDY", totalBytes: 5 },
  0x1f: { mnemonic: "BRCLR", mode: "BRSET_INDY", totalBytes: 5 },
  0x30: { mnemonic: "TSY", mode: "INH", totalBytes: 2 },
  0x35: { mnemonic: "TYS", mode: "INH", totalBytes: 2 },
  0x38: { mnemonic: "PULY", mode: "INH", totalBytes: 2 },
  0x3a: { mnemonic: "ABY", mode: "INH", totalBytes: 2 },
  0x3c: { mnemonic: "PSHY", mode: "INH", totalBytes: 2 },

  // $60..$6F: INDY (3 bytes)
  0x60: { mnemonic: "NEG", mode: "INDY", totalBytes: 3 },
  0x63: { mnemonic: "COM", mode: "INDY", totalBytes: 3 },
  0x64: { mnemonic: "LSR", mode: "INDY", totalBytes: 3 },
  0x66: { mnemonic: "ROR", mode: "INDY", totalBytes: 3 },
  0x67: { mnemonic: "ASR", mode: "INDY", totalBytes: 3 },
  0x68: { mnemonic: "ASL", mode: "INDY", totalBytes: 3 },
  0x69: { mnemonic: "ROL", mode: "INDY", totalBytes: 3 },
  0x6a: { mnemonic: "DEC", mode: "INDY", totalBytes: 3 },
  0x6c: { mnemonic: "INC", mode: "INDY", totalBytes: 3 },
  0x6d: { mnemonic: "TST", mode: "INDY", totalBytes: 3 },
  0x6e: { mnemonic: "JMP", mode: "INDY", totalBytes: 3 },
  0x6f: { mnemonic: "CLR", mode: "INDY", totalBytes: 3 },

  0x8c: { mnemonic: "CPY", mode: "IMM16", totalBytes: 4 },
  0x8f: { mnemonic: "XGDY", mode: "INH", totalBytes: 2 },
  0x9c: { mnemonic: "CPY", mode: "DIR", totalBytes: 3 },

  // $A0..$AF: INDY (3 bytes)
  0xa0: { mnemonic: "SUBA", mode: "INDY", totalBytes: 3 },
  0xa1: { mnemonic: "CMPA", mode: "INDY", totalBytes: 3 },
  0xa3: { mnemonic: "SUBD", mode: "INDY", totalBytes: 3 },
  0xa4: { mnemonic: "ANDA", mode: "INDY", totalBytes: 3 },
  0xa5: { mnemonic: "BITA", mode: "INDY", totalBytes: 3 },
  0xa6: { mnemonic: "LDAA", mode: "INDY", totalBytes: 3 },
  0xa7: { mnemonic: "STAA", mode: "INDY", totalBytes: 3 },
  0xa8: { mnemonic: "EORA", mode: "INDY", totalBytes: 3 },
  0xa9: { mnemonic: "ADCA", mode: "INDY", totalBytes: 3 },
  0xaa: { mnemonic: "ORAA", mode: "INDY", totalBytes: 3 },
  0xab: { mnemonic: "ADDA", mode: "INDY", totalBytes: 3 },
  0xac: { mnemonic: "CPY", mode: "INDY", totalBytes: 3 },
  0xad: { mnemonic: "JSR", mode: "INDY", totalBytes: 3 },
  0xae: { mnemonic: "LDS", mode: "INDY", totalBytes: 3 },
  0xaf: { mnemonic: "STS", mode: "INDY", totalBytes: 3 },

  0xbc: { mnemonic: "CPY", mode: "EXT", totalBytes: 4 },
  0xce: { mnemonic: "LDY", mode: "IMM16", totalBytes: 4 },
  0xde: { mnemonic: "LDY", mode: "DIR", totalBytes: 3 },
  0xdf: { mnemonic: "STY", mode: "DIR", totalBytes: 3 },

  // $E0..$EF: INDY (3 bytes)
  0xe0: { mnemonic: "SUBB", mode: "INDY", totalBytes: 3 },
  0xe1: { mnemonic: "CMPB", mode: "INDY", totalBytes: 3 },
  0xe3: { mnemonic: "ADDD", mode: "INDY", totalBytes: 3 },
  0xe4: { mnemonic: "ANDB", mode: "INDY", totalBytes: 3 },
  0xe5: { mnemonic: "BITB", mode: "INDY", totalBytes: 3 },
  0xe6: { mnemonic: "LDAB", mode: "INDY", totalBytes: 3 },
  0xe7: { mnemonic: "STAB", mode: "INDY", totalBytes: 3 },
  0xe8: { mnemonic: "EORB", mode: "INDY", totalBytes: 3 },
  0xe9: { mnemonic: "ADCB", mode: "INDY", totalBytes: 3 },
  0xea: { mnemonic: "ORAB", mode: "INDY", totalBytes: 3 },
  0xeb: { mnemonic: "ADDB", mode: "INDY", totalBytes: 3 },
  0xec: { mnemonic: "LDD", mode: "INDY", totalBytes: 3 },
  0xed: { mnemonic: "STD", mode: "INDY", totalBytes: 3 },
  0xee: { mnemonic: "LDY", mode: "INDY", totalBytes: 3 },
  0xef: { mnemonic: "STY", mode: "INDY", totalBytes: 3 },

  0xfe: { mnemonic: "LDY", mode: "EXT", totalBytes: 4 },
  0xff: { mnemonic: "STY", mode: "EXT", totalBytes: 4 },
};

// Tabla de página $1A (Prefijo 0x1A)
const PAGE_1A: Record<
  number,
  { mnemonic: string; mode: AddressingMode; totalBytes: number }
> = {
  0x83: { mnemonic: "CPD", mode: "IMM16", totalBytes: 4 },
  0x93: { mnemonic: "CPD", mode: "DIR", totalBytes: 3 },
  0xa3: { mnemonic: "CPD", mode: "INDX", totalBytes: 3 },
  0xac: { mnemonic: "CPY", mode: "INDX", totalBytes: 3 },
  0xb3: { mnemonic: "CPD", mode: "EXT", totalBytes: 4 },
  0xee: { mnemonic: "LDY", mode: "INDX", totalBytes: 3 },
  0xef: { mnemonic: "STY", mode: "INDX", totalBytes: 3 },
};

// Tabla de página $CD (Prefijo 0xCD)
const PAGE_CD: Record<
  number,
  { mnemonic: string; mode: AddressingMode; totalBytes: number }
> = {
  0xa3: { mnemonic: "CPD", mode: "INDY", totalBytes: 3 },
  0xac: { mnemonic: "CPX", mode: "INDY", totalBytes: 3 },
  0xee: { mnemonic: "LDX", mode: "INDY", totalBytes: 3 },
  0xef: { mnemonic: "STX", mode: "INDY", totalBytes: 3 },
};

/**
 * Desensambla un array de bytes en una instrucción 68HC11.
 * Si se especifica `baseAddress`, se calcula la dirección de destino efectiva de las bifurcaciones relativas.
 */
export function disassembleBytes(
  bytes: number[],
  baseAddress?: number | null,
): DisassemblyResult {
  if (!bytes || bytes.length === 0) {
    return {
      mnemonic: "",
      operands: "",
      formatted: "",
      mode: "RAW",
      opcodeBytesCount: 0,
      expectedParamBytes: 0,
      actualParamBytes: 0,
      isComplete: true,
      rawHex: [],
    };
  }

  const rawHex = bytes.map((b) => hexByte(b));
  const first = bytes[0];

  let opcode = first;
  let opcodeBytesCount = 1;
  let def:
    { mnemonic: string; mode: AddressingMode; totalBytes: number } | undefined;

  if (first === 0x18 || first === 0x1a || first === 0xcd) {
    const prefix = first;
    opcodeBytesCount = 2;
    if (bytes.length > 1) {
      opcode = bytes[1];
      if (prefix === 0x18) def = PAGE_18[opcode];
      else if (prefix === 0x1a) def = PAGE_1A[opcode];
      else if (prefix === 0xcd) def = PAGE_CD[opcode];
    } else {
      // Prefijo solitario sin segundo byte
      return {
        mnemonic: `$${hexByte(first)}`,
        operands: "...",
        formatted: `$${hexByte(first)} ...`,
        mode: "RAW",
        opcodeBytesCount: 1,
        expectedParamBytes: 1,
        actualParamBytes: 0,
        isComplete: false,
        rawHex,
      };
    }
  } else {
    def = PAGE_0[opcode];
  }

  if (!def) {
    // Opcode no reconocido / dato puro
    const hexList = rawHex.join(" ");
    return {
      mnemonic: "FCB",
      operands: hexList,
      formatted: `FCB ${hexList}`,
      mode: "RAW",
      opcodeBytesCount: 1,
      expectedParamBytes: 0,
      actualParamBytes: Math.max(0, bytes.length - 1),
      isComplete: true,
      rawHex,
    };
  }

  const expectedTotalBytes = def.totalBytes;
  const expectedParams = expectedTotalBytes - opcodeBytesCount;
  const operandsBytes = bytes.slice(opcodeBytesCount);
  const actualParamBytes = operandsBytes.length;
  const isComplete = bytes.length >= expectedTotalBytes;

  let operands = "";

  switch (def.mode) {
    case "INH": {
      operands = "";
      break;
    }
    case "IMM": {
      if (operandsBytes.length >= 1) {
        operands = `#$${hexByte(operandsBytes[0])}`;
      } else {
        operands = "#$??";
      }
      break;
    }
    case "IMM16": {
      if (operandsBytes.length >= 2) {
        const val = (operandsBytes[0] << 8) | operandsBytes[1];
        operands = `#$${hexWord(val)}`;
      } else if (operandsBytes.length === 1) {
        operands = `#$${hexByte(operandsBytes[0])}??`;
      } else {
        operands = "#$????";
      }
      break;
    }
    case "DIR": {
      if (operandsBytes.length >= 1) {
        operands = `$${hexByte(operandsBytes[0])}`;
      } else {
        operands = "$??";
      }
      break;
    }
    case "EXT": {
      if (operandsBytes.length >= 2) {
        const addr = (operandsBytes[0] << 8) | operandsBytes[1];
        operands = `$${hexWord(addr)}`;
      } else if (operandsBytes.length === 1) {
        operands = `$${hexByte(operandsBytes[0])}??`;
      } else {
        operands = "$????";
      }
      break;
    }
    case "INDX": {
      if (operandsBytes.length >= 1) {
        operands = `$${hexByte(operandsBytes[0])},X`;
      } else {
        operands = "$??,X";
      }
      break;
    }
    case "INDY": {
      if (operandsBytes.length >= 1) {
        operands = `$${hexByte(operandsBytes[0])},Y`;
      } else {
        operands = "$??,Y";
      }
      break;
    }
    case "REL": {
      if (operandsBytes.length >= 1) {
        const rel = operandsBytes[0];
        const signed = rel > 127 ? rel - 256 : rel;
        if (typeof baseAddress === "number") {
          const target = (baseAddress + expectedTotalBytes + signed) & 0xffff;
          operands = `$${hexWord(target)}`;
        } else {
          operands = `${signed >= 0 ? "+" : ""}${signed} ($${hexByte(rel)})`;
        }
      } else {
        operands = "$??";
      }
      break;
    }
    case "BSET_DIR": {
      const dirStr =
        operandsBytes.length >= 1 ? `$${hexByte(operandsBytes[0])}` : "$??";
      const maskStr =
        operandsBytes.length >= 2 ? `$${hexByte(operandsBytes[1])}` : "$??";
      operands = `${dirStr}, ${maskStr}`;
      break;
    }
    case "BSET_INDX": {
      const offStr =
        operandsBytes.length >= 1 ? `$${hexByte(operandsBytes[0])},X` : "$??,X";
      const maskStr =
        operandsBytes.length >= 2 ? `$${hexByte(operandsBytes[1])}` : "$??";
      operands = `${offStr}, ${maskStr}`;
      break;
    }
    case "BSET_INDY": {
      const offStr =
        operandsBytes.length >= 1 ? `$${hexByte(operandsBytes[0])},Y` : "$??,Y";
      const maskStr =
        operandsBytes.length >= 2 ? `$${hexByte(operandsBytes[1])}` : "$??";
      operands = `${offStr}, ${maskStr}`;
      break;
    }
    case "BRSET_DIR": {
      const dirStr =
        operandsBytes.length >= 1 ? `$${hexByte(operandsBytes[0])}` : "$??";
      const maskStr =
        operandsBytes.length >= 2 ? `$${hexByte(operandsBytes[1])}` : "$??";
      let destStr = "$????";
      if (operandsBytes.length >= 3) {
        const rel = operandsBytes[2];
        const signed = rel > 127 ? rel - 256 : rel;
        if (typeof baseAddress === "number") {
          const target = (baseAddress + expectedTotalBytes + signed) & 0xffff;
          destStr = `$${hexWord(target)}`;
        } else {
          destStr = `$${hexByte(rel)}`;
        }
      }
      operands = `${dirStr}, ${maskStr}, ${destStr}`;
      break;
    }
    case "BRSET_INDX": {
      const offStr =
        operandsBytes.length >= 1 ? `$${hexByte(operandsBytes[0])},X` : "$??,X";
      const maskStr =
        operandsBytes.length >= 2 ? `$${hexByte(operandsBytes[1])}` : "$??";
      let destStr = "$????";
      if (operandsBytes.length >= 3) {
        const rel = operandsBytes[2];
        const signed = rel > 127 ? rel - 256 : rel;
        if (typeof baseAddress === "number") {
          const target = (baseAddress + expectedTotalBytes + signed) & 0xffff;
          destStr = `$${hexWord(target)}`;
        } else {
          destStr = `$${hexByte(rel)}`;
        }
      }
      operands = `${offStr}, ${maskStr}, ${destStr}`;
      break;
    }
    case "BRSET_INDY": {
      const offStr =
        operandsBytes.length >= 1 ? `$${hexByte(operandsBytes[0])},Y` : "$??,Y";
      const maskStr =
        operandsBytes.length >= 2 ? `$${hexByte(operandsBytes[1])}` : "$??";
      let destStr = "$????";
      if (operandsBytes.length >= 3) {
        const rel = operandsBytes[2];
        const signed = rel > 127 ? rel - 256 : rel;
        if (typeof baseAddress === "number") {
          const target = (baseAddress + expectedTotalBytes + signed) & 0xffff;
          destStr = `$${hexWord(target)}`;
        } else {
          destStr = `$${hexByte(rel)}`;
        }
      }
      operands = `${offStr}, ${maskStr}, ${destStr}`;
      break;
    }
  }

  // Si hay parámetros sobrantes más allá de los esperados
  if (operandsBytes.length > expectedParams) {
    const extraHex = operandsBytes.slice(expectedParams).map(hexByte).join(" ");
    operands = `${operands} [+ ${extraHex}]`;
  }

  const formatted = operands ? `${def.mnemonic} ${operands}` : def.mnemonic;

  return {
    mnemonic: def.mnemonic,
    operands,
    formatted,
    mode: def.mode,
    opcodeBytesCount,
    expectedParamBytes: expectedParams,
    actualParamBytes,
    isComplete,
    rawHex,
  };
}

/**
 * Desensambla un array de strings hexadecimales.
 */
export function disassembleHexStrings(
  hexStrings: string[],
  baseAddress?: number | null,
): DisassemblyResult {
  const bytes = hexStrings
    .map((s) => parseInt(s.trim().replace(/^(\$|0x)/i, ""), 16))
    .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 255);
  return disassembleBytes(bytes, baseAddress);
}
