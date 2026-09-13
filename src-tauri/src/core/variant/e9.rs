//! MC68HC11E9.
//!
//! source_id: E5
//! section: 1.3/Figure 1-1; 2.3/Figure 2-4; 2.3.3.2; 5.3.1-5.3.2; 5.5/Table 5-4
//! printed_page: 17, 37, 50-51, 93-94, 99
//! pdf_page: 17, 37, 50-51, 93-94, 99
//! visual_review: true

use super::profile::Profile;

pub const MC68HC11E9: Profile = Profile {
    id: "mc68hc11e9",
    ram_bytes: 512,
    eeprom_bytes: 512,
    rom_bytes: 12 * 1024,
    register_bytes: 64,
    eeprom_start: 0xB600,
    rom_start: 0xD000,
    reset_init: 0x01,
    reset_vector: 0xFFFE,
    init_write_window_cycles: 64,
    reset_vector_fetch_cycles: 3,
};

pub const INIT_OFFSET: u8 = 0x3D;
pub const PAGE_SHIFT: u8 = 12;
