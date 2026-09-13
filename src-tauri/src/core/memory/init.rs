//! Registro INIT y relocación de RAM/registros.
//!
//! source_id: E5
//! section: 2.3.3.2, Figure 2-12, Tables 2-4 and 2-5
//! printed_page: 50-51
//! pdf_page: 50-51
//! visual_review: true

use super::super::variant::e9::{INIT_OFFSET, PAGE_SHIFT};

pub const INIT_REGISTER_OFFSET: u8 = INIT_OFFSET;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InitMap {
    pub value: u8,
    pub ram_base: u16,
    pub register_base: u16,
    pub locked: bool,
}

impl InitMap {
    pub fn from_reset_value(value: u8) -> Self {
        Self {
            value,
            ram_base: page_base(value >> 4),
            register_base: page_base(value & 0x0F),
            locked: false,
        }
    }

    #[allow(dead_code)]
    pub fn try_write(&mut self, value: u8, e_cycles: u64, window_cycles: u64) -> bool {
        if self.locked || e_cycles >= window_cycles {
            return false;
        }
        *self = Self {
            value,
            ram_base: page_base(value >> 4),
            register_base: page_base(value & 0x0F),
            locked: true,
        };
        true
    }
}

fn page_base(nibble: u8) -> u16 {
    u16::from(nibble & 0x0F) << PAGE_SHIFT
}

#[cfg(test)]
mod tests {
    use super::InitMap;

    #[test]
    fn reset_value_maps_ram_0000_and_registers_1000() {
        let map = InitMap::from_reset_value(0x01);
        assert_eq!(map.ram_base, 0x0000);
        assert_eq!(map.register_base, 0x1000);
        assert!(!map.locked);
    }

    #[test]
    fn write_once_within_window() {
        let mut map = InitMap::from_reset_value(0x01);
        assert!(map.try_write(0x23, 10, 64));
        assert_eq!(map.ram_base, 0x2000);
        assert_eq!(map.register_base, 0x3000);
        assert!(!map.try_write(0x45, 11, 64));
        assert_eq!(map.value, 0x23);
    }

    #[test]
    fn write_rejected_after_window() {
        let mut map = InitMap::from_reset_value(0x01);
        assert!(!map.try_write(0x11, 64, 64));
        assert_eq!(map.value, 0x01);
        assert!(!map.locked);
    }
}
