//! Resolución de operandos. Palabra big-endian; wrapping explícito.
//!
//! source_id: E5
//! section: 4.5.2-4.5.6; 4.3
//! printed_page: 80, 79
//! pdf_page: 80, 79
//! visual_review: true

use super::super::memory::Bus;
use super::decode::Mode;
use super::registers::Registers;

pub fn operand_address(cpu: &Registers, bus: &Bus, pc: u16, prefix: Option<u8>, mode: Mode) -> u16 {
    let base = pc.wrapping_add(if prefix.is_some() { 2 } else { 1 });
    match mode {
        Mode::Dir => u16::from(bus.read_byte(base)),
        Mode::Ext => bus.read_word(base),
        Mode::IndX => cpu.x.wrapping_add(u16::from(bus.read_byte(base))),
        Mode::IndY => cpu.y.wrapping_add(u16::from(bus.read_byte(base))),
        Mode::Inh | Mode::Imm | Mode::Imm16 | Mode::Rel => 0,
    }
}

pub fn read_operand8(cpu: &Registers, bus: &Bus, pc: u16, prefix: Option<u8>, mode: Mode) -> u8 {
    let base = pc.wrapping_add(if prefix.is_some() { 2 } else { 1 });
    match mode {
        Mode::Imm => bus.read_byte(base),
        Mode::Dir | Mode::Ext | Mode::IndX | Mode::IndY => {
            bus.read_byte(operand_address(cpu, bus, pc, prefix, mode))
        }
        Mode::Inh | Mode::Imm16 | Mode::Rel => 0,
    }
}

pub fn read_operand16(cpu: &Registers, bus: &Bus, pc: u16, prefix: Option<u8>, mode: Mode) -> u16 {
    let base = pc.wrapping_add(if prefix.is_some() { 2 } else { 1 });
    match mode {
        Mode::Imm16 => bus.read_word(base),
        Mode::Dir | Mode::Ext | Mode::IndX | Mode::IndY => {
            bus.read_word(operand_address(cpu, bus, pc, prefix, mode))
        }
        Mode::Inh | Mode::Imm | Mode::Rel => 0,
    }
}

pub fn rel_offset(bus: &Bus, pc: u16) -> i8 {
    bus.read_byte(pc.wrapping_add(1)) as i8
}

#[cfg(test)]
mod tests {
    use super::{operand_address, read_operand8, read_operand16, rel_offset};
    use crate::core::cpu::Registers;
    use crate::core::cpu::decode::Mode;
    use crate::core::memory::Bus;

    fn cpu_at(pc: u16, x: u16) -> Registers {
        let mut cpu = Registers::after_reset(pc);
        cpu.x = x;
        cpu
    }

    fn cpu_xy(pc: u16, x: u16, y: u16) -> Registers {
        let mut cpu = Registers::after_reset(pc);
        cpu.x = x;
        cpu.y = y;
        cpu
    }

    #[test]
    fn imm_dir_ext_indx_and_relative() {
        let mut bus = Bus::new_e9();
        bus.write_byte(0x0001, 0x55, 0);
        bus.write_byte(0x0002, 0x01, 0);
        bus.write_byte(0x0003, 0x20, 0);
        bus.write_byte(0x0055, 0xAB, 0);
        bus.write_byte(0x0120, 0xCD, 0);
        bus.write_byte(0x0121, 0xEF, 0);
        bus.write_byte(0x0105, 0x99, 0);

        let cpu = cpu_at(0x0000, 0x0100);
        assert_eq!(read_operand8(&cpu, &bus, 0x0000, None, Mode::Imm), 0x55);
        assert_eq!(operand_address(&cpu, &bus, 0x0000, None, Mode::Dir), 0x0055);
        assert_eq!(read_operand8(&cpu, &bus, 0x0000, None, Mode::Dir), 0xAB);
        assert_eq!(operand_address(&cpu, &bus, 0x0001, None, Mode::Ext), 0x0120);
        assert_eq!(read_operand16(&cpu, &bus, 0x0001, None, Mode::Ext), 0xCDEF);
        assert_eq!(
            operand_address(&cpu, &bus, 0x0000, None, Mode::IndX),
            0x0155
        );
        let indexed = cpu_at(0x0000, 0x0100);
        bus.write_byte(0x0001, 0x05, 0);
        assert_eq!(
            operand_address(&indexed, &bus, 0x0000, None, Mode::IndX),
            0x0105
        );
        assert_eq!(
            read_operand8(&indexed, &bus, 0x0000, None, Mode::IndX),
            0x99
        );
        assert_eq!(rel_offset(&bus, 0x0000), 5);
        let with_y = cpu_xy(0x0000, 0, 0x0200);
        bus.write_byte(0x0001, 0x10, 0);
        bus.write_byte(0x0210, 0x77, 0);
        assert_eq!(
            operand_address(&with_y, &bus, 0x0000, None, Mode::IndY),
            0x0210
        );
        assert_eq!(read_operand8(&with_y, &bus, 0x0000, None, Mode::IndY), 0x77);
    }

    #[test]
    fn indexed_wraps_and_prefix_skips_page_byte() {
        let mut bus = Bus::new_e9();
        bus.write_byte(0x0002, 0x01, 0);
        let cpu = cpu_at(0x0000, 0xFFFF);
        assert_eq!(
            operand_address(&cpu, &bus, 0x0000, Some(0x18), Mode::IndX),
            0
        );
        let cpu_y = {
            let mut regs = Registers::after_reset(0x0000);
            regs.y = 0xFFFF;
            regs
        };
        assert_eq!(
            operand_address(&cpu_y, &bus, 0x0000, Some(0x18), Mode::IndY),
            0
        );
        bus.write_byte(0x0001, 0x12, 0);
        bus.write_byte(0x0002, 0x34, 0);
        assert_eq!(
            read_operand16(&cpu, &bus, 0x0000, None, Mode::Imm16),
            0x1234
        );
    }
}
