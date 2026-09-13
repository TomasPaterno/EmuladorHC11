//! Modelo de registros del programador.
//!
//! source_id: E5
//! section: 4.2.1-4.2.5, Figure 4-1
//! printed_page: 74-76
//! pdf_page: 74-76
//! visual_review: true

use super::ccr::Ccr;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Registers {
    pub a: u8,
    pub b: u8,
    pub x: u16,
    pub y: u16,
    pub sp: u16,
    pub pc: u16,
    pub ccr: Ccr,
}

impl Registers {
    /// A, B, IX, IY y SP quedan en 0 solo para determinismo del emulador.
    /// E5 §5.3.1 indica que esos registros son indeterminados tras reset.
    pub fn after_reset(pc: u16) -> Self {
        Self {
            a: 0,
            b: 0,
            x: 0,
            y: 0,
            sp: 0,
            pc,
            ccr: Ccr::after_reset(),
        }
    }

    /// D es A:B, byte alto A.
    pub fn d(&self) -> u16 {
        u16::from(self.a) << 8 | u16::from(self.b)
    }

    pub fn set_d(&mut self, value: u16) {
        self.a = (value >> 8) as u8;
        self.b = value as u8;
    }
}

#[cfg(test)]
mod tests {
    use super::Registers;

    #[test]
    fn accumulator_d_is_a_high_b_low() {
        let mut registers = Registers::after_reset(0);
        registers.a = 0x12;
        registers.b = 0x34;
        assert_eq!(registers.d(), 0x1234);
        registers.set_d(0xABCD);
        assert_eq!(registers.a, 0xAB);
        assert_eq!(registers.b, 0xCD);
    }
}
