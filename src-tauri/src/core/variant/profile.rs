//! Perfil de variante. No existe un HC11 genérico ejecutable.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Profile {
    pub id: &'static str,
    pub ram_bytes: u16,
    pub eeprom_bytes: u16,
    pub rom_bytes: u16,
    pub register_bytes: u16,
    pub eeprom_start: u16,
    pub rom_start: u16,
    pub reset_init: u8,
    pub reset_vector: u16,
    pub init_write_window_cycles: u64,
    pub reset_vector_fetch_cycles: u64,
}

impl Profile {
    pub fn ram_end_offset(self) -> u16 {
        self.ram_bytes.saturating_sub(1)
    }

    pub fn register_end_offset(self) -> u16 {
        self.register_bytes.saturating_sub(1)
    }
}
