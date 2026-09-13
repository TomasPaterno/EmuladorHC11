//! Bus de 64 KiB con overlay de regiones E9.
//!
//! El mapa `overlay` es RAM de sesión de placa para direcciones no internas
//! (p. ej. `$2000` / `$3000` de un listado). No forma parte del mapa E9.
//!
//! source_id: E5
//! section: 4.1; 4.3; 2.3.1; 2.3/Figure 2-4
//! printed_page: 73, 79, 44, 37
//! pdf_page: 73, 79, 44, 37
//! visual_review: true

use std::collections::BTreeMap;

use super::super::error::CoreError;
use super::super::variant::{MC68HC11E9, Profile};
use super::init::{INIT_REGISTER_OFFSET, InitMap};

const UNMAPPED_READ: u8 = 0xFF;
const ERASED_BYTE: u8 = 0xFF;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Region {
    Register(u8),
    Ram(u16),
    Eeprom(u16),
    Rom(u16),
    Unmapped,
}

#[derive(Debug, Clone)]
pub struct Bus {
    profile: Profile,
    ram: Vec<u8>,
    eeprom: Vec<u8>,
    rom: Vec<u8>,
    registers: Vec<u8>,
    map: InitMap,
    overlay: BTreeMap<u16, u8>,
}

impl Bus {
    pub fn new_e9() -> Self {
        Self::new(MC68HC11E9)
    }

    pub fn new(profile: Profile) -> Self {
        let mut bus = Self {
            ram: vec![0; usize::from(profile.ram_bytes)],
            eeprom: vec![ERASED_BYTE; usize::from(profile.eeprom_bytes)],
            rom: vec![ERASED_BYTE; usize::from(profile.rom_bytes)],
            registers: vec![0; usize::from(profile.register_bytes)],
            map: InitMap::from_reset_value(profile.reset_init),
            overlay: BTreeMap::new(),
            profile,
        };
        bus.write_register_byte(INIT_REGISTER_OFFSET, profile.reset_init);
        bus
    }

    pub fn profile(&self) -> Profile {
        self.profile
    }

    pub fn init_value(&self) -> u8 {
        self.map.value
    }

    #[allow(dead_code)]
    pub fn ram_base(&self) -> u16 {
        self.map.ram_base
    }

    #[allow(dead_code)]
    pub fn register_base(&self) -> u16 {
        self.map.register_base
    }

    pub fn reset_map(&mut self) {
        self.map = InitMap::from_reset_value(self.profile.reset_init);
        self.registers.fill(0);
        self.write_register_byte(INIT_REGISTER_OFFSET, self.profile.reset_init);
    }

    pub fn read_byte(&self, address: u16) -> u8 {
        match self.region(address) {
            Region::Register(offset) => self.registers[usize::from(offset)],
            Region::Ram(offset) => self.ram[usize::from(offset)],
            Region::Eeprom(offset) => self.eeprom[usize::from(offset)],
            Region::Rom(offset) => self.rom[usize::from(offset)],
            Region::Unmapped => self.overlay.get(&address).copied().unwrap_or(UNMAPPED_READ),
        }
    }

    #[allow(dead_code)]
    pub fn write_byte(&mut self, address: u16, value: u8, e_cycles: u64) {
        match self.region(address) {
            Region::Register(offset) if offset == INIT_REGISTER_OFFSET => {
                if self
                    .map
                    .try_write(value, e_cycles, self.profile.init_write_window_cycles)
                {
                    self.write_register_byte(INIT_REGISTER_OFFSET, self.map.value);
                }
            }
            Region::Register(offset) => self.write_register_byte(offset, value),
            Region::Ram(offset) => self.ram[usize::from(offset)] = value,
            Region::Eeprom(_) | Region::Rom(_) => {}
            Region::Unmapped => {
                self.overlay.insert(address, value);
            }
        }
    }

    /// Palabra big-endian: MSB en la dirección menor.
    pub fn read_word(&self, address: u16) -> u16 {
        let high = u16::from(self.read_byte(address));
        let low = u16::from(self.read_byte(address.wrapping_add(1)));
        high << 8 | low
    }

    #[allow(dead_code)]
    pub fn write_word(&mut self, address: u16, value: u16, e_cycles: u64) {
        self.write_byte(address, (value >> 8) as u8, e_cycles);
        self.write_byte(address.wrapping_add(1), value as u8, e_cycles);
    }

    pub fn load_byte(&mut self, address: u16, value: u8) -> Result<(), CoreError> {
        match self.region(address) {
            Region::Ram(offset) => {
                self.ram[usize::from(offset)] = value;
                Ok(())
            }
            Region::Eeprom(offset) => {
                self.eeprom[usize::from(offset)] = value;
                Ok(())
            }
            Region::Rom(offset) => {
                self.rom[usize::from(offset)] = value;
                Ok(())
            }
            Region::Unmapped => {
                self.overlay.insert(address, value);
                Ok(())
            }
            Region::Register(_) => Err(CoreError::LoadRejected { address }),
        }
    }

    fn write_register_byte(&mut self, offset: u8, value: u8) {
        self.registers[usize::from(offset)] = value;
    }

    fn region(&self, address: u16) -> Region {
        if let Some(offset) = offset_in(
            address,
            self.map.register_base,
            self.profile.register_end_offset(),
        ) {
            return Region::Register(offset as u8);
        }
        if let Some(offset) = offset_in(address, self.map.ram_base, self.profile.ram_end_offset()) {
            return Region::Ram(offset);
        }
        if let Some(offset) = offset_in(
            address,
            self.profile.eeprom_start,
            self.profile.eeprom_bytes.saturating_sub(1),
        ) {
            return Region::Eeprom(offset);
        }
        if let Some(offset) = offset_in(
            address,
            self.profile.rom_start,
            self.profile.rom_bytes.saturating_sub(1),
        ) {
            return Region::Rom(offset);
        }
        Region::Unmapped
    }
}

fn offset_in(address: u16, start: u16, last_offset: u16) -> Option<u16> {
    let end = start.wrapping_add(last_offset);
    if address >= start && address <= end {
        Some(address - start)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::Bus;

    #[test]
    fn word_is_big_endian() {
        let mut bus = Bus::new_e9();
        bus.write_word(0x0010, 0x1234, 0);
        assert_eq!(bus.read_byte(0x0010), 0x12);
        assert_eq!(bus.read_byte(0x0011), 0x34);
        assert_eq!(bus.read_word(0x0010), 0x1234);
    }

    #[test]
    fn registers_have_priority_over_ram() {
        let mut bus = Bus::new_e9();
        bus.write_byte(0x103D, 0x11, 0);
        assert_eq!(bus.ram_base(), 0x1000);
        assert_eq!(bus.register_base(), 0x1000);
        bus.write_byte(0x1000, 0xAA, 1);
        assert_eq!(bus.read_byte(0x1000), 0xAA);
        bus.load_byte(0x1040, 0x55).expect("RAM detrás del bloque");
        assert_eq!(bus.read_byte(0x1040), 0x55);
    }

    #[test]
    fn ram_has_priority_over_rom() {
        let mut bus = Bus::new_e9();
        bus.load_byte(0xD200, 0x11).expect("ROM fuera del overlay");
        bus.write_byte(0x103D, 0xD1, 0);
        bus.write_byte(0xD000, 0x22, 1);
        assert_eq!(bus.read_byte(0xD000), 0x22);
        assert_eq!(bus.read_byte(0xD200), 0x11);
    }

    #[test]
    fn cpu_cannot_program_rom() {
        let mut bus = Bus::new_e9();
        bus.load_byte(0xE000, 0x01).expect("ROM");
        bus.write_byte(0xE000, 0x00, 0);
        assert_eq!(bus.read_byte(0xE000), 0x01);
    }

    #[test]
    fn unmapped_reads_as_ff() {
        let bus = Bus::new_e9();
        assert_eq!(bus.read_byte(0x2000), 0xFF);
    }

    #[test]
    fn session_overlay_load_write_and_survives_reset_map() {
        let mut bus = Bus::new_e9();
        bus.load_byte(0x2000, 0x86).expect("overlay");
        assert_eq!(bus.read_byte(0x2000), 0x86);
        bus.write_byte(0x3000, 0x11, 0);
        assert_eq!(bus.read_byte(0x3000), 0x11);
        bus.reset_map();
        assert_eq!(bus.read_byte(0x2000), 0x86);
        assert_eq!(bus.read_byte(0x3000), 0x11);
        assert_eq!(bus.read_byte(0x2001), 0xFF);
    }
}
