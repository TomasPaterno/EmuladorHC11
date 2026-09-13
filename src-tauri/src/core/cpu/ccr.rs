//! Condition Code Register.
//!
//! source_id: E5
//! section: 4.2.6, Figure 4-1
//! printed_page: 74, 77-78
//! pdf_page: 74, 77-78
//! visual_review: true

/// Bits de CCR de MSB a LSB: S X H I N Z V C.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Ccr {
    pub s: bool,
    pub x: bool,
    pub h: bool,
    pub i: bool,
    pub n: bool,
    pub z: bool,
    pub v: bool,
    pub c: bool,
}

impl Ccr {
    pub const S: u8 = 1 << 7;
    pub const X: u8 = 1 << 6;
    pub const H: u8 = 1 << 5;
    pub const I: u8 = 1 << 4;
    pub const N: u8 = 1 << 3;
    pub const Z: u8 = 1 << 2;
    pub const V: u8 = 1 << 1;
    pub const C: u8 = 1 << 0;

    /// Tras reset, X, I y S quedan establecidos.
    ///
    /// source_id: E5
    /// section: 5.3.1
    /// printed_page: 94
    /// pdf_page: 94
    /// visual_review: true
    pub fn after_reset() -> Self {
        Self {
            s: true,
            x: true,
            h: false,
            i: true,
            n: false,
            z: false,
            v: false,
            c: false,
        }
    }

    pub fn from_bits(bits: u8) -> Self {
        Self {
            s: bits & Self::S != 0,
            x: bits & Self::X != 0,
            h: bits & Self::H != 0,
            i: bits & Self::I != 0,
            n: bits & Self::N != 0,
            z: bits & Self::Z != 0,
            v: bits & Self::V != 0,
            c: bits & Self::C != 0,
        }
    }

    pub fn bits(self) -> u8 {
        let mut value = 0;
        if self.s {
            value |= Self::S;
        }
        if self.x {
            value |= Self::X;
        }
        if self.h {
            value |= Self::H;
        }
        if self.i {
            value |= Self::I;
        }
        if self.n {
            value |= Self::N;
        }
        if self.z {
            value |= Self::Z;
        }
        if self.v {
            value |= Self::V;
        }
        if self.c {
            value |= Self::C;
        }
        value
    }
}

#[cfg(test)]
mod tests {
    use super::Ccr;

    #[test]
    fn pack_unpack_roundtrip() {
        let bits = 0b1010_0101;
        assert_eq!(Ccr::from_bits(bits).bits(), bits);
    }

    #[test]
    fn reset_sets_s_x_i_only() {
        let ccr = Ccr::after_reset();
        assert_eq!(ccr.bits(), Ccr::S | Ccr::X | Ccr::I);
    }
}
