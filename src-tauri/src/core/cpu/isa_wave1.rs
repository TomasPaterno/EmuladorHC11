//! Pruebas de la ola 1: PC, ciclos, registros, memoria y CCR.
//!
//! source_id: E5
//! section: 4.6, Table 4-2
//! printed_page: 80-87
//! pdf_page: 80-87
//! visual_review: true

#[cfg(test)]
mod tests {
    use crate::core::cpu::ccr::Ccr;
    use crate::core::error::CoreError;
    use crate::core::machine::Machine;

    fn ready(pc: u16, image: &[u8]) -> Machine {
        let mut machine = Machine::new_e9();
        machine
            .load_bytes(0xFFFE, &[(pc >> 8) as u8, pc as u8])
            .expect("vector");
        machine.load_bytes(pc, image).expect("imagen");
        machine.reset();
        machine
    }

    #[test]
    fn clra_clears_a_and_sets_z() {
        let mut machine = ready(0x0000, &[0x4F]);
        machine.cpu_mut().a = 0x80;
        machine.step().expect("CLRA");
        assert_eq!(machine.cpu().a, 0);
        assert_eq!(machine.cpu().pc, 0x0001);
        assert_eq!(machine.cycles(), 5);
        assert!(machine.cpu().ccr.z);
        assert!(!machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.c);
    }

    #[test]
    fn inca_sets_v_on_7f() {
        let mut machine = ready(0x0000, &[0x4C]);
        machine.cpu_mut().a = 0x7F;
        machine.step().expect("INCA");
        assert_eq!(machine.cpu().a, 0x80);
        assert!(machine.cpu().ccr.n);
        assert!(machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.z);
    }

    #[test]
    fn deca_sets_v_on_80() {
        let mut machine = ready(0x0000, &[0x4A]);
        machine.cpu_mut().a = 0x80;
        machine.step().expect("DECA");
        assert_eq!(machine.cpu().a, 0x7F);
        assert!(machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.n);
    }

    #[test]
    fn adda_imm_updates_h_n_z_v_c() {
        let mut machine = ready(0x0000, &[0x8B, 0x01]);
        machine.cpu_mut().a = 0x7F;
        machine.step().expect("ADDA");
        assert_eq!(machine.cpu().a, 0x80);
        assert_eq!(machine.cpu().pc, 0x0002);
        assert_eq!(machine.cycles(), 5);
        assert!(machine.cpu().ccr.n);
        assert!(machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.c);
        assert!(machine.cpu().ccr.h);
    }

    #[test]
    fn suba_imm_sets_carry_on_borrow() {
        let mut machine = ready(0x0000, &[0x80, 0x01]);
        machine.cpu_mut().a = 0x00;
        machine.step().expect("SUBA");
        assert_eq!(machine.cpu().a, 0xFF);
        assert!(machine.cpu().ccr.c);
        assert!(machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.z);
    }

    #[test]
    fn ldaa_dir_and_staa_dir() {
        let mut machine = ready(0x0000, &[0x96, 0x10, 0x97, 0x11]);
        machine.write_data_byte(0x0010, 0x55);
        machine.step().expect("LDAA");
        assert_eq!(machine.cpu().a, 0x55);
        assert!(!machine.cpu().ccr.z);
        machine.step().expect("STAA");
        assert_eq!(machine.bus().read_byte(0x0011), 0x55);
        assert_eq!(machine.cpu().pc, 0x0004);
    }

    #[test]
    fn ldd_imm_and_ldx_dir() {
        let mut machine = ready(0x0000, &[0xCC, 0x12, 0x34, 0xDE, 0x20]);
        machine.write_data_byte(0x0020, 0xAB);
        machine.write_data_byte(0x0021, 0xCD);
        machine.step().expect("LDD");
        assert_eq!(machine.cpu().d(), 0x1234);
        machine.step().expect("LDX");
        assert_eq!(machine.cpu().x, 0xABCD);
        assert!(machine.cpu().ccr.n);
    }

    #[test]
    fn psha_pula_roundtrip() {
        let mut machine = ready(0x0000, &[0x36, 0x4F, 0x32]);
        machine.cpu_mut().a = 0x42;
        machine.cpu_mut().sp = 0x00FF;
        machine.step().expect("PSHA");
        assert_eq!(machine.bus().read_byte(0x00FF), 0x42);
        assert_eq!(machine.cpu().sp, 0x00FE);
        machine.step().expect("CLRA");
        machine.step().expect("PULA");
        assert_eq!(machine.cpu().a, 0x42);
        assert_eq!(machine.cpu().sp, 0x00FF);
    }

    #[test]
    fn beq_taken_and_bne_not_taken() {
        let mut machine = ready(0x0000, &[0x4F, 0x27, 0x02, 0x01, 0x01]);
        machine.step().expect("CLRA");
        machine.step().expect("BEQ");
        assert_eq!(machine.cpu().pc, 0x0005);
        machine.cpu_mut().pc = 0x0001;
        machine.cpu_mut().ccr.z = false;
        machine.step().expect("BEQ no");
        assert_eq!(machine.cpu().pc, 0x0003);
    }

    #[test]
    fn bsr_jsr_rts() {
        let mut machine = ready(0x0000, &[0x8D, 0x02, 0x01, 0x01, 0x39]);
        machine.cpu_mut().sp = 0x00FF;
        machine.step().expect("BSR");
        assert_eq!(machine.cpu().pc, 0x0004);
        assert_eq!(machine.bus().read_byte(0x00FF), 0x02);
        assert_eq!(machine.bus().read_byte(0x00FE), 0x00);
        machine.step().expect("RTS");
        assert_eq!(machine.cpu().pc, 0x0002);
    }

    #[test]
    fn jmp_ext() {
        let mut machine = ready(0x0000, &[0x7E, 0x00, 0x40]);
        machine.step().expect("JMP");
        assert_eq!(machine.cpu().pc, 0x0040);
        assert_eq!(machine.cycles(), 6);
    }

    #[test]
    fn asla_sets_c_from_bit7() {
        let mut machine = ready(0x0000, &[0x48]);
        machine.cpu_mut().a = 0x80;
        machine.step().expect("ASLA");
        assert_eq!(machine.cpu().a, 0x00);
        assert!(machine.cpu().ccr.c);
        assert!(machine.cpu().ccr.z);
        assert!(machine.cpu().ccr.v);
    }

    #[test]
    fn anda_imm_clears_v() {
        let mut machine = ready(0x0000, &[0x84, 0x0F]);
        machine.cpu_mut().a = 0xF3;
        machine.cpu_mut().ccr.v = true;
        machine.step().expect("ANDA");
        assert_eq!(machine.cpu().a, 0x03);
        assert!(!machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.n);
    }

    #[test]
    fn tap_cannot_set_x() {
        let mut machine = ready(0x0000, &[0x06]);
        machine.cpu_mut().ccr.x = false;
        machine.cpu_mut().a = Ccr::S | Ccr::X | Ccr::C;
        machine.step().expect("TAP");
        assert!(!machine.cpu().ccr.x);
        assert!(machine.cpu().ccr.s);
        assert!(machine.cpu().ccr.c);
    }

    #[test]
    fn run_stops_on_unimplemented() {
        let mut machine = ready(0x0000, &[0x01, 0x01, 0xFF]);
        let outcome = machine.run(10).expect("run");
        assert_eq!(outcome.steps_taken, 2);
        assert!(matches!(
            outcome.stop,
            crate::core::cpu::trace::RunStop::Unimplemented
        ));
        assert_eq!(machine.cpu().pc, 0x0002);
        let error = machine.step().expect_err("FF");
        assert!(matches!(
            error,
            CoreError::UnimplementedOpcode {
                pc: 0x0002,
                opcode: 0xFF
            }
        ));
    }

    #[test]
    fn inspect_memory_limit() {
        let machine = Machine::new_e9();
        assert!(machine.inspect_memory(0, 256).is_ok());
        assert!(matches!(
            machine.inspect_memory(0, 257),
            Err(CoreError::InspectTooLarge { length: 257 })
        ));
    }

    #[test]
    fn inherent_transfers_and_page18() {
        let mut machine = ready(0x0000, &[0x16, 0x8F, 0x18, 0x08]);
        machine.cpu_mut().a = 0x80;
        machine.step().expect("TAB");
        assert_eq!(machine.cpu().b, 0x80);
        assert!(machine.cpu().ccr.n);
        machine.cpu_mut().x = 0x1111;
        machine.step().expect("XGDX");
        assert_eq!(machine.cpu().x, 0x8080);
        assert_eq!(machine.cpu().d(), 0x1111);
        machine.step().expect("INY");
        assert_eq!(machine.cpu().y, 1);
        assert!(!machine.cpu().ccr.z);
        assert_eq!(machine.cpu().pc, 0x0004);
        assert_eq!(machine.cycles(), 3 + 2 + 3 + 4);
    }

    #[test]
    fn tsx_txs_and_flag_immediates() {
        let mut machine = ready(0x0000, &[0x30, 0x35, 0x0C, 0x0D, 0x0A, 0x0B]);
        machine.cpu_mut().sp = 0x00FE;
        machine.step().expect("TSX");
        assert_eq!(machine.cpu().x, 0x00FF);
        machine.step().expect("TXS");
        assert_eq!(machine.cpu().sp, 0x00FE);
        machine.step().expect("CLC");
        assert!(!machine.cpu().ccr.c);
        machine.step().expect("SEC");
        assert!(machine.cpu().ccr.c);
        machine.step().expect("CLV");
        assert!(!machine.cpu().ccr.v);
        machine.step().expect("SEV");
        assert!(machine.cpu().ccr.v);
    }

    #[test]
    fn ldaa_imm_ext_indx_and_staa_ext() {
        let mut machine = ready(
            0x0000,
            &[0x86, 0x22, 0xB6, 0x00, 0x40, 0xA6, 0x01, 0xB7, 0x00, 0x41],
        );
        machine.write_data_byte(0x0040, 0x33);
        machine.write_data_byte(0x00B1, 0x44);
        machine.step().expect("LDAA IMM");
        assert_eq!(machine.cpu().a, 0x22);
        machine.step().expect("LDAA EXT");
        assert_eq!(machine.cpu().a, 0x33);
        machine.cpu_mut().x = 0x00B0;
        machine.step().expect("LDAA INDX");
        assert_eq!(machine.cpu().a, 0x44);
        machine.step().expect("STAA EXT");
        assert_eq!(machine.bus().read_byte(0x0041), 0x44);
        assert_eq!(machine.cpu().pc, 0x000A);
    }

    #[test]
    fn std_stx_and_addd_subb() {
        let mut machine = ready(
            0x0000,
            &[0xDD, 0x20, 0xDF, 0x22, 0xC3, 0x00, 0x01, 0xC0, 0x01],
        );
        machine.cpu_mut().set_d(0xBEEF);
        machine.cpu_mut().x = 0x1234;
        machine.step().expect("STD");
        assert_eq!(machine.bus().read_byte(0x0020), 0xBE);
        assert_eq!(machine.bus().read_byte(0x0021), 0xEF);
        machine.step().expect("STX");
        assert_eq!(machine.bus().read_word(0x0022), 0x1234);
        machine.step().expect("ADDD");
        assert_eq!(machine.cpu().d(), 0xBEF0);
        machine.step().expect("SUBB");
        assert_eq!(machine.cpu().b, 0xEF);
        assert!(!machine.cpu().ccr.c);
    }

    #[test]
    fn cmpa_leaves_h_and_sba_updates_h() {
        let mut machine = ready(0x0000, &[0x81, 0x01, 0x10]);
        machine.cpu_mut().a = 0x10;
        machine.cpu_mut().b = 0x01;
        machine.cpu_mut().ccr.h = false;
        machine.step().expect("CMPA");
        assert_eq!(machine.cpu().a, 0x10);
        assert!(!machine.cpu().ccr.h);
        assert!(!machine.cpu().ccr.c);
        machine.step().expect("SBA");
        assert_eq!(machine.cpu().a, 0x0F);
        assert!(machine.cpu().ccr.h);
    }

    #[test]
    fn nega_coma_rola_and_tsta() {
        let mut machine = ready(0x0000, &[0x40, 0x43, 0x49, 0x4D]);
        machine.cpu_mut().a = 0x80;
        machine.step().expect("NEGA");
        assert_eq!(machine.cpu().a, 0x80);
        assert!(machine.cpu().ccr.v);
        assert!(machine.cpu().ccr.c);
        machine.step().expect("COMA");
        assert_eq!(machine.cpu().a, 0x7F);
        assert!(machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.v);
        machine.cpu_mut().ccr.c = true;
        machine.step().expect("ROLA");
        assert_eq!(machine.cpu().a, 0xFF);
        assert!(!machine.cpu().ccr.c);
        machine.step().expect("TSTA");
        assert!(machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.v);
    }

    #[test]
    fn signed_and_unsigned_branches() {
        type Setup = fn(&mut Ccr);
        let cases: &[(u8, Setup, u16)] = &[
            (0x20, |_| {}, 0x0006),
            (0x27, |ccr| ccr.z = true, 0x0006),
            (0x26, |ccr| ccr.z = false, 0x0006),
            (0x24, |ccr| ccr.c = false, 0x0006),
            (0x25, |ccr| ccr.c = true, 0x0006),
            (0x2B, |ccr| ccr.n = true, 0x0006),
            (0x2A, |ccr| ccr.n = false, 0x0006),
            (
                0x22,
                |ccr| {
                    ccr.c = false;
                    ccr.z = false;
                },
                0x0006,
            ),
            (0x23, |ccr| ccr.c = true, 0x0006),
            (
                0x2C,
                |ccr| {
                    ccr.n = true;
                    ccr.v = true;
                },
                0x0006,
            ),
            (
                0x2D,
                |ccr| {
                    ccr.n = true;
                    ccr.v = false;
                },
                0x0006,
            ),
            (
                0x2E,
                |ccr| {
                    ccr.z = false;
                    ccr.n = false;
                    ccr.v = false;
                },
                0x0006,
            ),
            (0x2F, |ccr| ccr.z = true, 0x0006),
        ];
        for (opcode, setup, pc) in cases {
            let mut machine = ready(0x0000, &[*opcode, 0x04, 0x01, 0x01, 0x01, 0x01]);
            setup(&mut machine.cpu_mut().ccr);
            machine.step().expect("branch");
            assert_eq!(machine.cpu().pc, *pc, "opcode {opcode:02X}");
            assert_eq!(machine.cycles(), 6);
        }
    }

    #[test]
    fn jsr_ext_then_rts() {
        let mut machine = ready(0x0000, &[0xBD, 0x00, 0x10]);
        machine.load_bytes(0x0010, &[0x39]).expect("RTS");
        machine.cpu_mut().sp = 0x00FF;
        machine.step().expect("JSR");
        assert_eq!(machine.cpu().pc, 0x0010);
        assert_eq!(machine.bus().read_byte(0x00FF), 0x03);
        assert_eq!(machine.bus().read_byte(0x00FE), 0x00);
        machine.step().expect("RTS");
        assert_eq!(machine.cpu().pc, 0x0003);
        assert_eq!(machine.cycles(), 3 + 6 + 5);
    }

    #[test]
    fn staa_indx_ldab_indx_and_dec_ext() {
        let mut machine = ready(0x0000, &[0xA7, 0x02, 0xE6, 0x02, 0x7A, 0x00, 0x20]);
        machine.cpu_mut().a = 0x55;
        machine.cpu_mut().x = 0x0010;
        machine.step().expect("STAA INDX");
        assert_eq!(machine.bus().read_byte(0x0012), 0x55);
        assert_eq!(machine.cpu().pc, 0x0002);
        assert_eq!(machine.cycles(), 3 + 4);
        machine.step().expect("LDAB INDX");
        assert_eq!(machine.cpu().b, 0x55);
        assert!(!machine.cpu().ccr.z);
        machine.write_data_byte(0x0020, 0x80);
        machine.cpu_mut().ccr.c = true;
        machine.step().expect("DEC EXT");
        assert_eq!(machine.bus().read_byte(0x0020), 0x7F);
        assert!(machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.n);
        assert!(machine.cpu().ccr.c);
        assert_eq!(machine.cpu().pc, 0x0007);
        assert_eq!(machine.cycles(), 3 + 4 + 4 + 6);
    }

    #[test]
    fn every_implemented_row_runs_and_accounts_cycles() {
        let mut implemented = 0;
        for opcode in 0u8..=255 {
            if step_if_implemented(&[opcode, 0, 0, 0]).is_some() {
                implemented += 1;
            }
        }
        for prefix in [0x18, 0x1A, 0xCD] {
            for opcode in 0u8..=255 {
                if step_if_implemented(&[prefix, opcode, 0, 0]).is_some() {
                    implemented += 1;
                }
            }
        }
        assert_eq!(implemented, 172);
    }

    fn step_if_implemented(image: &[u8]) -> Option<u64> {
        let mut machine = ready(0x0000, image);
        machine.cpu_mut().sp = 0x00F0;
        machine.write_data_byte(0x00F1, 0x00);
        machine.write_data_byte(0x00F2, 0x20);
        match machine.step() {
            Ok(trace) => {
                assert_eq!(machine.cycles(), 3 + trace.cycles_added);
                Some(trace.cycles_added)
            }
            Err(CoreError::UnimplementedOpcode { .. }) => None,
            Err(error) => panic!("{error}"),
        }
    }
}
