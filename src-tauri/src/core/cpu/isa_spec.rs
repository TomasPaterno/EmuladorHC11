//! Candado YAML↔decode y contrato CCR/ciclos de las filas human_verified.
//!
//! source_id: E5
//! section: 4.6, Table 4-2; 1.3/Figure 1-1; 2.3/Figure 2-4; 2.3.3.2; 5.3.1-5.3.2; 5.5/Table 5-4
//! printed_page: 17, 37, 50-51, 80-87, 93-94, 99
//! pdf_page: 17, 37, 50-51, 80-87, 93-94, 99
//! visual_review: true

#[cfg(test)]
mod tests {
    use crate::core::cpu::ccr::Ccr;
    use crate::core::cpu::decode::{Mode, implemented_rows};
    use crate::core::error::CoreError;
    use crate::core::machine::Machine;
    use crate::core::variant::{MC68HC11E9, e9::INIT_OFFSET};

    const INSTRUCTIONS_YAML: &str =
        include_str!("../../../../docs/hardware/spec/instructions.yaml");
    const VARIANTS_YAML: &str = include_str!("../../../../docs/hardware/spec/variants.yaml");
    const MEMORY_MAP_YAML: &str = include_str!("../../../../docs/hardware/spec/memory-map.yaml");
    const VECTORS_YAML: &str =
        include_str!("../../../../docs/hardware/spec/interrupt-vectors.yaml");

    const CONTROL_FLOW: &[&str] = &[
        "BRA", "BEQ", "BNE", "BCC", "BCS", "BMI", "BPL", "BHI", "BLS", "BGE", "BLT", "BGT", "BLE",
        "BSR", "JMP", "JSR", "RTS", "BRSET", "BRCLR",
    ];

    #[derive(Debug, Clone)]
    struct SpecRow {
        mnemonic: String,
        mode: String,
        prefix: Option<u8>,
        opcode: u8,
        bytes: u16,
        cycles: u64,
        ccr: CcrContract,
        review_status: String,
    }

    #[derive(Debug, Clone)]
    struct CcrContract {
        s: String,
        x: String,
        h: String,
        i: String,
        n: String,
        z: String,
        v: String,
        c: String,
    }

    impl CcrContract {
        fn get(&self, bit: &str) -> &str {
            match bit {
                "s" => &self.s,
                "x" => &self.x,
                "h" => &self.h,
                "i" => &self.i,
                "n" => &self.n,
                "z" => &self.z,
                "v" => &self.v,
                "c" => &self.c,
                _ => panic!("bit CCR desconocido {bit}"),
            }
        }
    }

    fn parse_instructions() -> Vec<SpecRow> {
        let root: serde_yaml::Value =
            serde_yaml::from_str(INSTRUCTIONS_YAML).expect("instructions.yaml");
        root["instructions"]
            .as_sequence()
            .expect("instructions")
            .iter()
            .map(parse_row)
            .collect()
    }

    fn parse_row(value: &serde_yaml::Value) -> SpecRow {
        let opcode = value["opcode"]
            .as_sequence()
            .expect("opcode")
            .iter()
            .map(|entry| u8::try_from(entry.as_u64().expect("opcode byte")).expect("u8"))
            .collect::<Vec<_>>();
        let (prefix, op) = match opcode.as_slice() {
            [op] => (None, *op),
            [prefix, op] => (Some(*prefix), *op),
            _ => panic!("opcode debe tener 1 o 2 bytes: {opcode:?}"),
        };
        let ccr = &value["ccr"];
        SpecRow {
            mnemonic: value["mnemonic"].as_str().expect("mnemonic").to_string(),
            mode: value["mode"].as_str().expect("mode").to_string(),
            prefix,
            opcode: op,
            bytes: u16::try_from(value["bytes"].as_u64().expect("bytes")).expect("bytes"),
            cycles: value["cycles"].as_u64().expect("cycles"),
            ccr: CcrContract {
                s: ccr_field(ccr, "s"),
                x: ccr_field(ccr, "x"),
                h: ccr_field(ccr, "h"),
                i: ccr_field(ccr, "i"),
                n: ccr_field(ccr, "n"),
                z: ccr_field(ccr, "z"),
                v: ccr_field(ccr, "v"),
                c: ccr_field(ccr, "c"),
            },
            review_status: value["review_status"]
                .as_str()
                .expect("review_status")
                .to_string(),
        }
    }

    fn ccr_field(ccr: &serde_yaml::Value, bit: &str) -> String {
        ccr[bit]
            .as_str()
            .unwrap_or_else(|| panic!("ccr.{bit}"))
            .to_string()
    }

    fn row_key(prefix: Option<u8>, opcode: u8) -> (u8, u8) {
        (prefix.unwrap_or(0), opcode)
    }

    fn bit(ccr: &Ccr, name: &str) -> bool {
        match name {
            "s" => ccr.s,
            "x" => ccr.x,
            "h" => ccr.h,
            "i" => ccr.i,
            "n" => ccr.n,
            "z" => ccr.z,
            "v" => ccr.v,
            "c" => ccr.c,
            _ => panic!("bit CCR desconocido {name}"),
        }
    }

    fn set_all_ccr(ccr: &mut Ccr, value: bool) {
        ccr.s = value;
        ccr.x = value;
        ccr.h = value;
        ccr.i = value;
        ccr.n = value;
        ccr.z = value;
        ccr.v = value;
        ccr.c = value;
    }

    fn ready(image: &[u8]) -> Machine {
        let mut machine = Machine::new_e9();
        machine.load_bytes(0xFFFE, &[0x00, 0x00]).expect("vector");
        machine.load_bytes(0x0000, image).expect("imagen");
        machine.reset();
        machine.cpu_mut().sp = 0x00F0;
        machine.write_data_byte(0x00F1, 0x00);
        machine.write_data_byte(0x00F2, 0x20);
        machine
    }

    #[test]
    fn yaml_rows_match_decode_inventory() {
        let spec = parse_instructions();
        assert!(
            spec.iter().all(|row| row.review_status == "human_verified"),
            "toda fila ejecutable debe estar human_verified"
        );

        let decoded = implemented_rows();
        assert_eq!(spec.len(), decoded.len());

        let mut spec_by_key = std::collections::BTreeMap::new();
        for row in &spec {
            let key = row_key(row.prefix, row.opcode);
            assert!(
                spec_by_key.insert(key, row).is_none(),
                "YAML duplicado {:02X}/{:02X}",
                key.0,
                key.1
            );
        }

        let mut decode_by_key = std::collections::BTreeMap::new();
        for row in &decoded {
            let key = row_key(row.prefix, row.opcode);
            assert!(
                decode_by_key.insert(key, row).is_none(),
                "decode duplicado {:02X}/{:02X}",
                key.0,
                key.1
            );
        }

        for (key, yaml) in &spec_by_key {
            let Some(row) = decode_by_key.get(key) else {
                panic!(
                    "YAML {} {} {:02X}/{:02X} no está en decode",
                    yaml.mnemonic,
                    yaml.mode,
                    yaml.prefix.unwrap_or(0),
                    yaml.opcode
                );
            };
            assert_eq!(row.mnemonic, yaml.mnemonic, "{yaml:?}");
            assert_eq!(row.mode.spec_name(), yaml.mode, "{yaml:?}");
            assert_eq!(row.bytes, yaml.bytes, "{yaml:?}");
            assert_eq!(row.cycles, yaml.cycles, "{yaml:?}");
        }

        for (key, row) in &decode_by_key {
            assert!(
                spec_by_key.contains_key(key),
                "decode {} {:02X}/{:02X} no está en YAML",
                row.mnemonic,
                key.0,
                key.1
            );
        }
    }

    #[test]
    fn e9_profile_matches_verified_yaml() {
        let variants: serde_yaml::Value =
            serde_yaml::from_str(VARIANTS_YAML).expect("variants.yaml");
        let e9 = variants["profiles"]
            .as_sequence()
            .expect("profiles")
            .iter()
            .find(|profile| profile["id"].as_str() == Some("mc68hc11e9"))
            .expect("mc68hc11e9");
        assert_eq!(
            e9["ram_bytes"].as_u64(),
            Some(u64::from(MC68HC11E9.ram_bytes))
        );
        assert_eq!(
            e9["eeprom_bytes"].as_u64(),
            Some(u64::from(MC68HC11E9.eeprom_bytes))
        );
        assert_eq!(
            e9["rom_bytes"].as_u64(),
            Some(u64::from(MC68HC11E9.rom_bytes))
        );

        let memory: serde_yaml::Value =
            serde_yaml::from_str(MEMORY_MAP_YAML).expect("memory-map.yaml");
        let regions = &memory["e_series_profiles"]["mc68hc11e9"]["regions"];
        let mut found_ram = false;
        let mut found_eeprom = false;
        let mut found_rom = false;
        for region in regions.as_sequence().expect("regions") {
            match region["id"].as_str() {
                Some("ram") => {
                    assert_eq!(region["start"].as_u64(), Some(0x0000));
                    assert_eq!(region["end"].as_u64(), Some(0x01FF));
                    found_ram = true;
                }
                Some("eeprom") => {
                    assert_eq!(
                        region["start"].as_u64(),
                        Some(u64::from(MC68HC11E9.eeprom_start))
                    );
                    assert_eq!(region["end"].as_u64(), Some(0xB7FF));
                    found_eeprom = true;
                }
                Some("rom") => {
                    assert_eq!(
                        region["start"].as_u64(),
                        Some(u64::from(MC68HC11E9.rom_start))
                    );
                    assert_eq!(region["end"].as_u64(), Some(0xFFFF));
                    found_rom = true;
                }
                _ => {}
            }
        }
        assert!(found_ram && found_eeprom && found_rom);

        let vectors: serde_yaml::Value =
            serde_yaml::from_str(VECTORS_YAML).expect("interrupt-vectors.yaml");
        let reset = vectors["e_series"]["entries"]
            .as_sequence()
            .expect("entries")
            .iter()
            .find(|entry| entry["id"].as_str() == Some("reset"))
            .expect("reset");
        assert_eq!(
            reset["start"].as_u64(),
            Some(u64::from(MC68HC11E9.reset_vector))
        );

        assert_eq!(MC68HC11E9.id, "mc68hc11e9");
        assert_eq!(MC68HC11E9.register_bytes, 64);
        assert_eq!(MC68HC11E9.reset_init, 0x01);
        assert_eq!(MC68HC11E9.init_write_window_cycles, 64);
        assert_eq!(MC68HC11E9.reset_vector_fetch_cycles, 3);
        assert_eq!(INIT_OFFSET, 0x3D);
    }

    #[test]
    fn every_yaml_row_honors_cycles_ccr_and_pc() {
        for spec in parse_instructions() {
            let mut image = match spec.prefix {
                Some(prefix) => vec![prefix, spec.opcode],
                None => vec![spec.opcode],
            };
            image.resize(8, 0);

            for all_set in [false, true] {
                let mut machine = ready(&image);
                set_all_ccr(&mut machine.cpu_mut().ccr, all_set);
                let before = machine.cpu().ccr;
                let start_pc = machine.cpu().pc;
                let trace = machine
                    .step()
                    .unwrap_or_else(|error| panic!("{} {}: {error}", spec.mnemonic, spec.mode));
                assert_eq!(
                    trace.cycles_added, spec.cycles,
                    "{} {} ciclos",
                    spec.mnemonic, spec.mode
                );

                if !CONTROL_FLOW.contains(&spec.mnemonic.as_str()) {
                    assert_eq!(
                        machine.cpu().pc,
                        start_pc.wrapping_add(spec.bytes),
                        "{} {} PC",
                        spec.mnemonic,
                        spec.mode
                    );
                }

                let after = machine.cpu().ccr;
                for name in ["s", "x", "h", "i", "n", "z", "v", "c"] {
                    let rule = spec.ccr.get(name);
                    let before_bit = bit(&before, name);
                    let after_bit = bit(&after, name);
                    match rule {
                        "unchanged" => assert_eq!(
                            after_bit, before_bit,
                            "{} {} CCR.{name} debía quedar {before_bit}",
                            spec.mnemonic, spec.mode
                        ),
                        "clear" => assert!(
                            !after_bit,
                            "{} {} CCR.{name} debía quedar 0",
                            spec.mnemonic, spec.mode
                        ),
                        "set" => assert!(
                            after_bit,
                            "{} {} CCR.{name} debía quedar 1",
                            spec.mnemonic, spec.mode
                        ),
                        "clear_only" => {
                            if !before_bit {
                                assert!(
                                    !after_bit,
                                    "{} {} CCR.{name} clear_only no puede pasar a 1",
                                    spec.mnemonic, spec.mode
                                );
                            }
                        }
                        "update" => {}
                        other => panic!(
                            "{} {} CCR.{name} regla desconocida {other}",
                            spec.mnemonic, spec.mode
                        ),
                    }
                }
            }
        }
    }

    #[test]
    fn decode_mode_names_cover_yaml_modes() {
        assert_eq!(Mode::Inh.spec_name(), "INH");
        assert_eq!(Mode::Imm.spec_name(), "IMM");
        assert_eq!(Mode::Imm16.spec_name(), "IMM");
        assert_eq!(Mode::Dir.spec_name(), "DIR");
        assert_eq!(Mode::Ext.spec_name(), "EXT");
        assert_eq!(Mode::IndX.spec_name(), "INDX");
        assert_eq!(Mode::IndY.spec_name(), "INDY");
        assert_eq!(Mode::Rel.spec_name(), "REL");
    }

    #[test]
    fn unknown_yaml_opcode_is_not_in_inventory() {
        assert!(
            implemented_rows()
                .iter()
                .all(|row| !(row.prefix.is_none() && row.opcode == 0xFF))
        );
        let mut machine = ready(&[0xFF]);
        assert!(matches!(
            machine.step(),
            Err(CoreError::UnimplementedOpcode {
                pc: 0,
                opcode: 0xFF
            })
        ));
    }
}
