//! Fetch/decode por páginas. Prefijos `$18` / `$1A` / `$CD` se reconocen;
//! las filas no verificadas siguen sin implementar.
//!
//! source_id: E5
//! section: 4.6, Table 4-2
//! printed_page: 80-87
//! pdf_page: 80-87
//! visual_review: true

use super::super::error::CoreError;
use super::super::memory::Bus;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Inh,
    Imm,
    Imm16,
    Dir,
    Ext,
    IndX,
    IndY,
    Rel,
}

#[cfg(test)]
impl Mode {
    /// Nombre de modo en `instructions.yaml`. IMM de 16 bits se transcribe como IMM.
    pub fn spec_name(self) -> &'static str {
        match self {
            Mode::Inh => "INH",
            Mode::Imm | Mode::Imm16 => "IMM",
            Mode::Dir => "DIR",
            Mode::Ext => "EXT",
            Mode::IndX => "INDX",
            Mode::IndY => "INDY",
            Mode::Rel => "REL",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Acc {
    A,
    B,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WordReg {
    D,
    X,
    Y,
    S,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Branch {
    Always,
    Eq,
    Ne,
    Cc,
    Cs,
    Mi,
    Pl,
    Hi,
    Ls,
    Ge,
    Lt,
    Gt,
    Le,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Op {
    Nop,
    Tab,
    Tba,
    Tap,
    Tpa,
    Tsx,
    Txs,
    Tsy,
    Tys,
    Xgdx,
    Xgdy,
    Psha,
    Pshb,
    Pula,
    Pulb,
    Pshx,
    Pulx,
    Pshy,
    Puly,
    Clc,
    Sec,
    Cli,
    Sei,
    Clv,
    Sev,
    Ins,
    Des,
    Inx,
    Dex,
    Iny,
    Dey,
    Inc(Acc),
    Dec(Acc),
    DecMem(Mode),
    IncMem(Mode),
    ClrMem(Mode),
    Clr(Acc),
    Com(Acc),
    Neg(Acc),
    Asl(Acc),
    Asr(Acc),
    Lsr(Acc),
    Rol(Acc),
    Ror(Acc),
    Tst(Acc),
    Aba,
    Sba,
    Cba,
    Ld8(Acc, Mode),
    Ld16(WordReg, Mode),
    St8(Acc, Mode),
    St16(WordReg, Mode),
    Add8(Acc, Mode),
    AddC8(Acc, Mode),
    Add16(Mode),
    Sub8(Acc, Mode),
    And8(Acc, Mode),
    Ora8(Acc, Mode),
    Eor8(Acc, Mode),
    Cmp8(Acc, Mode),
    Bit8(Acc, Mode),
    Bra(Branch),
    Bsr,
    Jmp(Mode),
    Jsr(Mode),
    Rts,
    Mul,
    Bset(Mode),
    Bclr(Mode),
    BrSet(Mode),
    BrClr(Mode),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Decoded {
    pub mnemonic: &'static str,
    pub op: Op,
    pub mode: Mode,
    pub opcode: u8,
    pub prefix: Option<u8>,
    pub bytes: u16,
    pub cycles: u64,
}

pub fn decode(bus: &Bus, pc: u16) -> Result<Decoded, CoreError> {
    let first = bus.read_byte(pc);
    if first == 0x18 {
        let second = bus.read_byte(pc.wrapping_add(1));
        return page_18(pc, second);
    }
    if first == 0x1A {
        return page_1a(pc, bus.read_byte(pc.wrapping_add(1)));
    }
    if first == 0xCD {
        return page_cd(pc, bus.read_byte(pc.wrapping_add(1)));
    }
    page_0(pc, first)
}

fn page_0(pc: u16, op: u8) -> Result<Decoded, CoreError> {
    let row = match op {
        0x01 => ("NOP", Op::Nop, Mode::Inh, 1, 2),
        0x06 => ("TAP", Op::Tap, Mode::Inh, 1, 2),
        0x07 => ("TPA", Op::Tpa, Mode::Inh, 1, 2),
        0x08 => ("INX", Op::Inx, Mode::Inh, 1, 3),
        0x09 => ("DEX", Op::Dex, Mode::Inh, 1, 3),
        0x0A => ("CLV", Op::Clv, Mode::Inh, 1, 2),
        0x0B => ("SEV", Op::Sev, Mode::Inh, 1, 2),
        0x0C => ("CLC", Op::Clc, Mode::Inh, 1, 2),
        0x0D => ("SEC", Op::Sec, Mode::Inh, 1, 2),
        0x0E => ("CLI", Op::Cli, Mode::Inh, 1, 2),
        0x0F => ("SEI", Op::Sei, Mode::Inh, 1, 2),
        0x10 => ("SBA", Op::Sba, Mode::Inh, 1, 2),
        0x11 => ("CBA", Op::Cba, Mode::Inh, 1, 2),
        0x12 => ("BRSET", Op::BrSet(Mode::Dir), Mode::Dir, 4, 6),
        0x13 => ("BRCLR", Op::BrClr(Mode::Dir), Mode::Dir, 4, 6),
        0x14 => ("BSET", Op::Bset(Mode::Dir), Mode::Dir, 3, 6),
        0x15 => ("BCLR", Op::Bclr(Mode::Dir), Mode::Dir, 3, 6),
        0x16 => ("TAB", Op::Tab, Mode::Inh, 1, 2),
        0x17 => ("TBA", Op::Tba, Mode::Inh, 1, 2),
        0x1B => ("ABA", Op::Aba, Mode::Inh, 1, 2),
        0x1C => ("BSET", Op::Bset(Mode::IndX), Mode::IndX, 3, 7),
        0x1D => ("BCLR", Op::Bclr(Mode::IndX), Mode::IndX, 3, 7),
        0x1E => ("BRSET", Op::BrSet(Mode::IndX), Mode::IndX, 4, 7),
        0x1F => ("BRCLR", Op::BrClr(Mode::IndX), Mode::IndX, 4, 7),
        0x20 => ("BRA", Op::Bra(Branch::Always), Mode::Rel, 2, 3),
        0x22 => ("BHI", Op::Bra(Branch::Hi), Mode::Rel, 2, 3),
        0x23 => ("BLS", Op::Bra(Branch::Ls), Mode::Rel, 2, 3),
        0x24 => ("BCC", Op::Bra(Branch::Cc), Mode::Rel, 2, 3),
        0x25 => ("BCS", Op::Bra(Branch::Cs), Mode::Rel, 2, 3),
        0x26 => ("BNE", Op::Bra(Branch::Ne), Mode::Rel, 2, 3),
        0x27 => ("BEQ", Op::Bra(Branch::Eq), Mode::Rel, 2, 3),
        0x2A => ("BPL", Op::Bra(Branch::Pl), Mode::Rel, 2, 3),
        0x2B => ("BMI", Op::Bra(Branch::Mi), Mode::Rel, 2, 3),
        0x2C => ("BGE", Op::Bra(Branch::Ge), Mode::Rel, 2, 3),
        0x2D => ("BLT", Op::Bra(Branch::Lt), Mode::Rel, 2, 3),
        0x2E => ("BGT", Op::Bra(Branch::Gt), Mode::Rel, 2, 3),
        0x2F => ("BLE", Op::Bra(Branch::Le), Mode::Rel, 2, 3),
        0x30 => ("TSX", Op::Tsx, Mode::Inh, 1, 3),
        0x31 => ("INS", Op::Ins, Mode::Inh, 1, 3),
        0x32 => ("PULA", Op::Pula, Mode::Inh, 1, 4),
        0x33 => ("PULB", Op::Pulb, Mode::Inh, 1, 4),
        0x34 => ("DES", Op::Des, Mode::Inh, 1, 3),
        0x35 => ("TXS", Op::Txs, Mode::Inh, 1, 3),
        0x36 => ("PSHA", Op::Psha, Mode::Inh, 1, 3),
        0x37 => ("PSHB", Op::Pshb, Mode::Inh, 1, 3),
        0x38 => ("PULX", Op::Pulx, Mode::Inh, 1, 5),
        0x39 => ("RTS", Op::Rts, Mode::Inh, 1, 5),
        0x3C => ("PSHX", Op::Pshx, Mode::Inh, 1, 4),
        0x3D => ("MUL", Op::Mul, Mode::Inh, 1, 10),
        0x40 => ("NEGA", Op::Neg(Acc::A), Mode::Inh, 1, 2),
        0x43 => ("COMA", Op::Com(Acc::A), Mode::Inh, 1, 2),
        0x44 => ("LSRA", Op::Lsr(Acc::A), Mode::Inh, 1, 2),
        0x46 => ("RORA", Op::Ror(Acc::A), Mode::Inh, 1, 2),
        0x47 => ("ASRA", Op::Asr(Acc::A), Mode::Inh, 1, 2),
        0x48 => ("ASLA", Op::Asl(Acc::A), Mode::Inh, 1, 2),
        0x49 => ("ROLA", Op::Rol(Acc::A), Mode::Inh, 1, 2),
        0x4A => ("DECA", Op::Dec(Acc::A), Mode::Inh, 1, 2),
        0x4C => ("INCA", Op::Inc(Acc::A), Mode::Inh, 1, 2),
        0x4D => ("TSTA", Op::Tst(Acc::A), Mode::Inh, 1, 2),
        0x4F => ("CLRA", Op::Clr(Acc::A), Mode::Inh, 1, 2),
        0x50 => ("NEGB", Op::Neg(Acc::B), Mode::Inh, 1, 2),
        0x53 => ("COMB", Op::Com(Acc::B), Mode::Inh, 1, 2),
        0x54 => ("LSRB", Op::Lsr(Acc::B), Mode::Inh, 1, 2),
        0x56 => ("RORB", Op::Ror(Acc::B), Mode::Inh, 1, 2),
        0x57 => ("ASRB", Op::Asr(Acc::B), Mode::Inh, 1, 2),
        0x58 => ("ASLB", Op::Asl(Acc::B), Mode::Inh, 1, 2),
        0x59 => ("ROLB", Op::Rol(Acc::B), Mode::Inh, 1, 2),
        0x5A => ("DECB", Op::Dec(Acc::B), Mode::Inh, 1, 2),
        0x5C => ("INCB", Op::Inc(Acc::B), Mode::Inh, 1, 2),
        0x5D => ("TSTB", Op::Tst(Acc::B), Mode::Inh, 1, 2),
        0x5F => ("CLRB", Op::Clr(Acc::B), Mode::Inh, 1, 2),
        0x6A => ("DEC", Op::DecMem(Mode::IndX), Mode::IndX, 2, 6),
        0x6C => ("INC", Op::IncMem(Mode::IndX), Mode::IndX, 2, 6),
        0x6E => ("JMP", Op::Jmp(Mode::IndX), Mode::IndX, 2, 3),
        0x6F => ("CLR", Op::ClrMem(Mode::IndX), Mode::IndX, 2, 6),
        0x7A => ("DEC", Op::DecMem(Mode::Ext), Mode::Ext, 3, 6),
        0x7C => ("INC", Op::IncMem(Mode::Ext), Mode::Ext, 3, 6),
        0x7E => ("JMP", Op::Jmp(Mode::Ext), Mode::Ext, 3, 3),
        0x7F => ("CLR", Op::ClrMem(Mode::Ext), Mode::Ext, 3, 6),
        0x80 => ("SUBA", Op::Sub8(Acc::A, Mode::Imm), Mode::Imm, 2, 2),
        0x81 => ("CMPA", Op::Cmp8(Acc::A, Mode::Imm), Mode::Imm, 2, 2),
        0x84 => ("ANDA", Op::And8(Acc::A, Mode::Imm), Mode::Imm, 2, 2),
        0x85 => ("BITA", Op::Bit8(Acc::A, Mode::Imm), Mode::Imm, 2, 2),
        0x86 => ("LDAA", Op::Ld8(Acc::A, Mode::Imm), Mode::Imm, 2, 2),
        0x88 => ("EORA", Op::Eor8(Acc::A, Mode::Imm), Mode::Imm, 2, 2),
        0x89 => ("ADCA", Op::AddC8(Acc::A, Mode::Imm), Mode::Imm, 2, 2),
        0x8A => ("ORAA", Op::Ora8(Acc::A, Mode::Imm), Mode::Imm, 2, 2),
        0x8B => ("ADDA", Op::Add8(Acc::A, Mode::Imm), Mode::Imm, 2, 2),
        0x8D => ("BSR", Op::Bsr, Mode::Rel, 2, 6),
        0x8E => ("LDS", Op::Ld16(WordReg::S, Mode::Imm16), Mode::Imm16, 3, 3),
        0x8F => ("XGDX", Op::Xgdx, Mode::Inh, 1, 3),
        0x90 => ("SUBA", Op::Sub8(Acc::A, Mode::Dir), Mode::Dir, 2, 3),
        0x96 => ("LDAA", Op::Ld8(Acc::A, Mode::Dir), Mode::Dir, 2, 3),
        0x97 => ("STAA", Op::St8(Acc::A, Mode::Dir), Mode::Dir, 2, 3),
        0x99 => ("ADCA", Op::AddC8(Acc::A, Mode::Dir), Mode::Dir, 2, 3),
        0x9B => ("ADDA", Op::Add8(Acc::A, Mode::Dir), Mode::Dir, 2, 3),
        0x9D => ("JSR", Op::Jsr(Mode::Dir), Mode::Dir, 2, 5),
        0x9E => ("LDS", Op::Ld16(WordReg::S, Mode::Dir), Mode::Dir, 2, 4),
        0x9F => ("STS", Op::St16(WordReg::S, Mode::Dir), Mode::Dir, 2, 4),
        0xA6 => ("LDAA", Op::Ld8(Acc::A, Mode::IndX), Mode::IndX, 2, 4),
        0xA7 => ("STAA", Op::St8(Acc::A, Mode::IndX), Mode::IndX, 2, 4),
        0xA9 => ("ADCA", Op::AddC8(Acc::A, Mode::IndX), Mode::IndX, 2, 4),
        0xAD => ("JSR", Op::Jsr(Mode::IndX), Mode::IndX, 2, 6),
        0xAE => ("LDS", Op::Ld16(WordReg::S, Mode::IndX), Mode::IndX, 2, 5),
        0xAF => ("STS", Op::St16(WordReg::S, Mode::IndX), Mode::IndX, 2, 5),
        0xB6 => ("LDAA", Op::Ld8(Acc::A, Mode::Ext), Mode::Ext, 3, 4),
        0xB7 => ("STAA", Op::St8(Acc::A, Mode::Ext), Mode::Ext, 3, 4),
        0xB9 => ("ADCA", Op::AddC8(Acc::A, Mode::Ext), Mode::Ext, 3, 4),
        0xBD => ("JSR", Op::Jsr(Mode::Ext), Mode::Ext, 3, 6),
        0xBE => ("LDS", Op::Ld16(WordReg::S, Mode::Ext), Mode::Ext, 3, 5),
        0xBF => ("STS", Op::St16(WordReg::S, Mode::Ext), Mode::Ext, 3, 5),
        0xC0 => ("SUBB", Op::Sub8(Acc::B, Mode::Imm), Mode::Imm, 2, 2),
        0xC3 => ("ADDD", Op::Add16(Mode::Imm16), Mode::Imm16, 3, 4),
        0xC6 => ("LDAB", Op::Ld8(Acc::B, Mode::Imm), Mode::Imm, 2, 2),
        0xC9 => ("ADCB", Op::AddC8(Acc::B, Mode::Imm), Mode::Imm, 2, 2),
        0xCB => ("ADDB", Op::Add8(Acc::B, Mode::Imm), Mode::Imm, 2, 2),
        0xCC => ("LDD", Op::Ld16(WordReg::D, Mode::Imm16), Mode::Imm16, 3, 3),
        0xCE => ("LDX", Op::Ld16(WordReg::X, Mode::Imm16), Mode::Imm16, 3, 3),
        0xD6 => ("LDAB", Op::Ld8(Acc::B, Mode::Dir), Mode::Dir, 2, 3),
        0xD7 => ("STAB", Op::St8(Acc::B, Mode::Dir), Mode::Dir, 2, 3),
        0xDC => ("LDD", Op::Ld16(WordReg::D, Mode::Dir), Mode::Dir, 2, 4),
        0xDD => ("STD", Op::St16(WordReg::D, Mode::Dir), Mode::Dir, 2, 4),
        0xDE => ("LDX", Op::Ld16(WordReg::X, Mode::Dir), Mode::Dir, 2, 4),
        0xE6 => ("LDAB", Op::Ld8(Acc::B, Mode::IndX), Mode::IndX, 2, 4),
        0xDF => ("STX", Op::St16(WordReg::X, Mode::Dir), Mode::Dir, 2, 4),
        0xF6 => ("LDAB", Op::Ld8(Acc::B, Mode::Ext), Mode::Ext, 3, 4),
        0xF7 => ("STAB", Op::St8(Acc::B, Mode::Ext), Mode::Ext, 3, 4),
        _ => return Err(CoreError::UnimplementedOpcode { pc, opcode: op }),
    };
    Ok(Decoded {
        mnemonic: row.0,
        op: row.1,
        mode: row.2,
        opcode: op,
        prefix: None,
        bytes: row.3,
        cycles: row.4,
    })
}

fn page_18(pc: u16, op: u8) -> Result<Decoded, CoreError> {
    let row = match op {
        0x08 => ("INY", Op::Iny, Mode::Inh, 2, 4),
        0x09 => ("DEY", Op::Dey, Mode::Inh, 2, 4),
        0x1C => ("BSET", Op::Bset(Mode::IndY), Mode::IndY, 4, 8),
        0x1D => ("BCLR", Op::Bclr(Mode::IndY), Mode::IndY, 4, 8),
        0x1E => ("BRSET", Op::BrSet(Mode::IndY), Mode::IndY, 5, 8),
        0x1F => ("BRCLR", Op::BrClr(Mode::IndY), Mode::IndY, 5, 8),
        0x30 => ("TSY", Op::Tsy, Mode::Inh, 2, 4),
        0x35 => ("TYS", Op::Tys, Mode::Inh, 2, 4),
        0x38 => ("PULY", Op::Puly, Mode::Inh, 2, 6),
        0x3C => ("PSHY", Op::Pshy, Mode::Inh, 2, 5),
        0x6A => ("DEC", Op::DecMem(Mode::IndY), Mode::IndY, 3, 7),
        0x6C => ("INC", Op::IncMem(Mode::IndY), Mode::IndY, 3, 7),
        0x6E => ("JMP", Op::Jmp(Mode::IndY), Mode::IndY, 3, 4),
        0x6F => ("CLR", Op::ClrMem(Mode::IndY), Mode::IndY, 3, 7),
        0x8F => ("XGDY", Op::Xgdy, Mode::Inh, 2, 4),
        0xA0 => ("SUBA", Op::Sub8(Acc::A, Mode::IndY), Mode::IndY, 3, 5),
        0xA1 => ("CMPA", Op::Cmp8(Acc::A, Mode::IndY), Mode::IndY, 3, 5),
        0xA4 => ("ANDA", Op::And8(Acc::A, Mode::IndY), Mode::IndY, 3, 5),
        0xA5 => ("BITA", Op::Bit8(Acc::A, Mode::IndY), Mode::IndY, 3, 5),
        0xA6 => ("LDAA", Op::Ld8(Acc::A, Mode::IndY), Mode::IndY, 3, 5),
        0xA7 => ("STAA", Op::St8(Acc::A, Mode::IndY), Mode::IndY, 3, 5),
        0xA8 => ("EORA", Op::Eor8(Acc::A, Mode::IndY), Mode::IndY, 3, 5),
        0xA9 => ("ADCA", Op::AddC8(Acc::A, Mode::IndY), Mode::IndY, 3, 5),
        0xAA => ("ORAA", Op::Ora8(Acc::A, Mode::IndY), Mode::IndY, 3, 5),
        0xAB => ("ADDA", Op::Add8(Acc::A, Mode::IndY), Mode::IndY, 3, 5),
        0xAD => ("JSR", Op::Jsr(Mode::IndY), Mode::IndY, 3, 7),
        0xAE => ("LDS", Op::Ld16(WordReg::S, Mode::IndY), Mode::IndY, 3, 6),
        0xAF => ("STS", Op::St16(WordReg::S, Mode::IndY), Mode::IndY, 3, 6),
        0xCE => ("LDY", Op::Ld16(WordReg::Y, Mode::Imm16), Mode::Imm16, 4, 4),
        0xDE => ("LDY", Op::Ld16(WordReg::Y, Mode::Dir), Mode::Dir, 3, 5),
        0xDF => ("STY", Op::St16(WordReg::Y, Mode::Dir), Mode::Dir, 3, 5),
        0xE0 => ("SUBB", Op::Sub8(Acc::B, Mode::IndY), Mode::IndY, 3, 5),
        0xE6 => ("LDAB", Op::Ld8(Acc::B, Mode::IndY), Mode::IndY, 3, 5),
        0xE7 => ("STAB", Op::St8(Acc::B, Mode::IndY), Mode::IndY, 3, 5),
        0xEB => ("ADDB", Op::Add8(Acc::B, Mode::IndY), Mode::IndY, 3, 5),
        0xEC => ("LDD", Op::Ld16(WordReg::D, Mode::IndY), Mode::IndY, 3, 6),
        0xED => ("STD", Op::St16(WordReg::D, Mode::IndY), Mode::IndY, 3, 6),
        0xEE => ("LDY", Op::Ld16(WordReg::Y, Mode::IndY), Mode::IndY, 3, 6),
        0xEF => ("STY", Op::St16(WordReg::Y, Mode::IndY), Mode::IndY, 3, 6),
        0xFE => ("LDY", Op::Ld16(WordReg::Y, Mode::Ext), Mode::Ext, 4, 6),
        0xFF => ("STY", Op::St16(WordReg::Y, Mode::Ext), Mode::Ext, 4, 6),
        _ => return Err(CoreError::UnimplementedOpcode { pc, opcode: 0x18 }),
    };
    Ok(Decoded {
        mnemonic: row.0,
        op: row.1,
        mode: row.2,
        opcode: op,
        prefix: Some(0x18),
        bytes: row.3,
        cycles: row.4,
    })
}

fn page_1a(pc: u16, op: u8) -> Result<Decoded, CoreError> {
    let row = match op {
        0xEE => ("LDY", Op::Ld16(WordReg::Y, Mode::IndX), Mode::IndX, 3, 6),
        0xEF => ("STY", Op::St16(WordReg::Y, Mode::IndX), Mode::IndX, 3, 6),
        _ => return Err(CoreError::UnimplementedOpcode { pc, opcode: 0x1A }),
    };
    Ok(Decoded {
        mnemonic: row.0,
        op: row.1,
        mode: row.2,
        opcode: op,
        prefix: Some(0x1A),
        bytes: row.3,
        cycles: row.4,
    })
}

/// Inventario de filas decodificables. Usado por el candado YAML↔decode.
#[cfg(test)]
pub fn implemented_rows() -> Vec<Decoded> {
    let mut rows = Vec::new();
    for opcode in 0u8..=255 {
        if let Ok(row) = page_0(0, opcode) {
            rows.push(row);
        }
    }
    for decoder in [
        page_18 as fn(u16, u8) -> Result<Decoded, CoreError>,
        page_1a,
        page_cd,
    ] {
        for opcode in 0u8..=255 {
            if let Ok(row) = decoder(0, opcode) {
                rows.push(row);
            }
        }
    }
    rows
}

fn page_cd(pc: u16, op: u8) -> Result<Decoded, CoreError> {
    let row = match op {
        0xEE => ("LDX", Op::Ld16(WordReg::X, Mode::IndY), Mode::IndY, 3, 6),
        0xEF => ("STX", Op::St16(WordReg::X, Mode::IndY), Mode::IndY, 3, 6),
        _ => return Err(CoreError::UnimplementedOpcode { pc, opcode: 0xCD }),
    };
    Ok(Decoded {
        mnemonic: row.0,
        op: row.1,
        mode: row.2,
        opcode: op,
        prefix: Some(0xCD),
        bytes: row.3,
        cycles: row.4,
    })
}

#[cfg(test)]
mod tests {
    use super::decode;
    use crate::core::error::CoreError;
    use crate::core::memory::Bus;

    fn bus_with(bytes: &[u8]) -> Bus {
        let mut bus = Bus::new_e9();
        for (index, value) in bytes.iter().enumerate() {
            bus.write_byte(index as u16, *value, 0);
        }
        bus
    }

    #[test]
    fn lab_wave_decodes_one_hundred_seventy_two_rows() {
        let mut bus = Bus::new_e9();
        let mut count = 0;
        for opcode in 0u8..=255 {
            bus.write_byte(0, opcode, 0);
            if decode(&bus, 0).is_ok() {
                count += 1;
            }
        }
        for prefix in [0x18, 0x1A, 0xCD] {
            bus.write_byte(0, prefix, 0);
            for opcode in 0u8..=255 {
                bus.write_byte(1, opcode, 0);
                if decode(&bus, 0).is_ok() {
                    count += 1;
                }
            }
        }
        assert_eq!(count, 172);
    }

    #[test]
    fn prefixes_without_verified_row_stay_unimplemented() {
        let bus_1a = bus_with(&[0x1A, 0x83]);
        assert!(matches!(
            decode(&bus_1a, 0),
            Err(CoreError::UnimplementedOpcode {
                pc: 0,
                opcode: 0x1A
            })
        ));
        let bus_cd = bus_with(&[0xCD, 0xCE]);
        assert!(matches!(
            decode(&bus_cd, 0),
            Err(CoreError::UnimplementedOpcode {
                pc: 0,
                opcode: 0xCD
            })
        ));
    }

    #[test]
    fn page18_iny_uses_prefix_and_four_cycles() {
        let bus = bus_with(&[0x18, 0x08]);
        let decoded = decode(&bus, 0).expect("INY");
        assert_eq!(decoded.mnemonic, "INY");
        assert_eq!(decoded.prefix, Some(0x18));
        assert_eq!(decoded.bytes, 2);
        assert_eq!(decoded.cycles, 4);
    }
}
