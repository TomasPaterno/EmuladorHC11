//! Pruebas de la ola de laboratorio: INDY, RMW, ADCA, MUL, bits y Y/SP.
//!
//! source_id: E5
//! section: 4.6, Table 4-2
//! printed_page: 80-87
//! pdf_page: 80-87
//! visual_review: true

#[cfg(test)]
mod tests {
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
    fn ldaa_staa_indy() {
        let mut machine = ready(0x0000, &[0x18, 0xA6, 0x02, 0x18, 0xA7, 0x03]);
        machine.cpu_mut().y = 0x0010;
        machine.write_data_byte(0x0012, 0x81);
        machine.step().expect("LDAA INDY");
        assert_eq!(machine.cpu().a, 0x81);
        assert!(machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.z);
        assert!(!machine.cpu().ccr.v);
        assert_eq!(machine.cpu().pc, 0x0003);
        assert_eq!(machine.cycles(), 3 + 5);
        machine.step().expect("STAA INDY");
        assert_eq!(machine.bus().read_byte(0x0013), 0x81);
        assert_eq!(machine.cpu().pc, 0x0006);
    }

    #[test]
    fn inc_ext_sets_v_on_7f() {
        let mut machine = ready(0x0000, &[0x7C, 0x00, 0x20]);
        machine.write_data_byte(0x0020, 0x7F);
        machine.cpu_mut().ccr.c = true;
        machine.step().expect("INC EXT");
        assert_eq!(machine.bus().read_byte(0x0020), 0x80);
        assert!(machine.cpu().ccr.n);
        assert!(machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.z);
        assert!(machine.cpu().ccr.c);
        assert_eq!(machine.cpu().pc, 0x0003);
        assert_eq!(machine.cycles(), 3 + 6);
    }

    #[test]
    fn clr_indx_forces_nzvc() {
        let mut machine = ready(0x0000, &[0x6F, 0x01]);
        machine.cpu_mut().x = 0x0030;
        machine.write_data_byte(0x0031, 0xAA);
        machine.cpu_mut().ccr.n = true;
        machine.cpu_mut().ccr.c = true;
        machine.cpu_mut().ccr.v = true;
        machine.step().expect("CLR INDX");
        assert_eq!(machine.bus().read_byte(0x0031), 0);
        assert!(!machine.cpu().ccr.n);
        assert!(machine.cpu().ccr.z);
        assert!(!machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.c);
        assert_eq!(machine.cpu().pc, 0x0002);
        assert_eq!(machine.cycles(), 3 + 6);
    }

    #[test]
    fn dec_indy_sets_v_on_80() {
        let mut machine = ready(0x0000, &[0x18, 0x6A, 0x00]);
        machine.cpu_mut().y = 0x0040;
        machine.write_data_byte(0x0040, 0x80);
        machine.step().expect("DEC INDY");
        assert_eq!(machine.bus().read_byte(0x0040), 0x7F);
        assert!(machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.n);
        assert_eq!(machine.cpu().pc, 0x0003);
        assert_eq!(machine.cycles(), 3 + 7);
    }

    #[test]
    fn adca_imm_adds_incoming_carry() {
        let mut machine = ready(0x0000, &[0x89, 0x00]);
        machine.cpu_mut().a = 0x7F;
        machine.cpu_mut().ccr.c = true;
        machine.step().expect("ADCA");
        assert_eq!(machine.cpu().a, 0x80);
        assert!(machine.cpu().ccr.n);
        assert!(machine.cpu().ccr.v);
        assert!(machine.cpu().ccr.h);
        assert!(!machine.cpu().ccr.c);
        assert_eq!(machine.cpu().pc, 0x0002);
        assert_eq!(machine.cycles(), 3 + 2);
    }

    #[test]
    fn adcb_imm_carry_out() {
        let mut machine = ready(0x0000, &[0xC9, 0x01]);
        machine.cpu_mut().b = 0xFF;
        machine.cpu_mut().ccr.c = true;
        machine.step().expect("ADCB");
        assert_eq!(machine.cpu().b, 0x01);
        assert!(machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.z);
        assert_eq!(machine.cycles(), 3 + 2);
    }

    #[test]
    fn jmp_indx_and_jmp_indy() {
        let mut machine = ready(0x0000, &[0x6E, 0x10]);
        machine.cpu_mut().x = 0x1200;
        machine.step().expect("JMP INDX");
        assert_eq!(machine.cpu().pc, 0x1210);
        assert_eq!(machine.cycles(), 3 + 3);

        let mut indy = ready(0x0000, &[0x18, 0x6E, 0x01]);
        indy.cpu_mut().y = 0x00FF;
        indy.step().expect("JMP INDY");
        assert_eq!(indy.cpu().pc, 0x0100);
        assert_eq!(indy.cycles(), 3 + 4);
    }

    #[test]
    fn jsr_dir_then_rts() {
        let mut machine = ready(0x0000, &[0x9D, 0x10]);
        machine.load_bytes(0x0010, &[0x39]).expect("RTS");
        machine.cpu_mut().sp = 0x00FF;
        machine.step().expect("JSR DIR");
        assert_eq!(machine.cpu().pc, 0x0010);
        assert_eq!(machine.bus().read_byte(0x00FF), 0x02);
        assert_eq!(machine.bus().read_byte(0x00FE), 0x00);
        machine.step().expect("RTS");
        assert_eq!(machine.cpu().pc, 0x0002);
        assert_eq!(machine.cycles(), 3 + 5 + 5);
    }

    #[test]
    fn mul_writes_d_and_c_from_b_bit7() {
        let mut machine = ready(0x0000, &[0x3D]);
        machine.cpu_mut().a = 0x10;
        machine.cpu_mut().b = 0x10;
        machine.cpu_mut().ccr.v = true;
        machine.step().expect("MUL");
        assert_eq!(machine.cpu().d(), 0x0100);
        assert!(!machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.z);
        assert!(!machine.cpu().ccr.c);
        assert!(machine.cpu().ccr.v);
        assert_eq!(machine.cpu().pc, 0x0001);
        assert_eq!(machine.cycles(), 3 + 10);

        let mut high = ready(0x0000, &[0x3D]);
        high.cpu_mut().a = 0x80;
        high.cpu_mut().b = 0x80;
        high.step().expect("MUL C");
        assert_eq!(high.cpu().d(), 0x4000);
        assert!(high.cpu().ccr.c);
        assert!(!high.cpu().ccr.n);

        let mut zero = ready(0x0000, &[0x3D]);
        zero.cpu_mut().a = 0;
        zero.cpu_mut().b = 0;
        zero.step().expect("MUL Z");
        assert_eq!(zero.cpu().d(), 0);
        assert!(zero.cpu().ccr.z);
        assert!(!zero.cpu().ccr.c);
    }

    #[test]
    fn ldy_imm_and_sts_dir() {
        let mut machine = ready(0x0000, &[0x18, 0xCE, 0x30, 0x00, 0x9F, 0x20]);
        machine.cpu_mut().sp = 0x00F0;
        machine.step().expect("LDY IMM");
        assert_eq!(machine.cpu().y, 0x3000);
        assert!(!machine.cpu().ccr.z);
        assert!(!machine.cpu().ccr.v);
        assert_eq!(machine.cpu().pc, 0x0004);
        assert_eq!(machine.cycles(), 3 + 4);
        machine.step().expect("STS DIR");
        assert_eq!(machine.bus().read_word(0x0020), 0x00F0);
        assert_eq!(machine.cpu().pc, 0x0006);
    }

    #[test]
    fn lds_imm_and_ldx_indy() {
        let mut machine = ready(0x0000, &[0x8E, 0x00, 0x80, 0xCD, 0xEE, 0x00]);
        machine.cpu_mut().y = 0x0030;
        machine.write_data_byte(0x0030, 0xAB);
        machine.write_data_byte(0x0031, 0xCD);
        machine.step().expect("LDS IMM");
        assert_eq!(machine.cpu().sp, 0x0080);
        machine.step().expect("LDX INDY");
        assert_eq!(machine.cpu().x, 0xABCD);
        assert!(machine.cpu().ccr.n);
        assert_eq!(machine.cpu().pc, 0x0006);
        assert_eq!(machine.cycles(), 3 + 3 + 6);
    }

    #[test]
    fn bset_dir_and_bclr_indx() {
        let mut machine = ready(0x0000, &[0x14, 0x40, 0x81, 0x1D, 0x00, 0x01]);
        machine.write_data_byte(0x0040, 0x00);
        machine.cpu_mut().x = 0x0040;
        machine.step().expect("BSET DIR");
        assert_eq!(machine.bus().read_byte(0x0040), 0x81);
        assert!(machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.v);
        assert_eq!(machine.cpu().pc, 0x0003);
        assert_eq!(machine.cycles(), 3 + 6);
        machine.step().expect("BCLR INDX");
        assert_eq!(machine.bus().read_byte(0x0040), 0x80);
        assert!(machine.cpu().ccr.n);
        assert_eq!(machine.cpu().pc, 0x0006);
        assert_eq!(machine.cycles(), 3 + 6 + 7);
    }

    #[test]
    fn brclr_taken_and_brset_not_taken() {
        let mut machine = ready(0x0000, &[0x13, 0x40, 0x01, 0x04, 0x01, 0x01, 0x01, 0x01]);
        machine.write_data_byte(0x0040, 0x80);
        machine.step().expect("BRCLR");
        assert_eq!(machine.cpu().pc, 0x0008);
        assert_eq!(machine.cycles(), 3 + 6);

        let mut stay = ready(0x0000, &[0x12, 0x40, 0x01, 0x04, 0x01]);
        stay.write_data_byte(0x0040, 0x80);
        let ccr = stay.cpu().ccr;
        stay.step().expect("BRSET no");
        assert_eq!(stay.cpu().pc, 0x0004);
        assert_eq!(stay.cpu().ccr, ccr);
        assert_eq!(stay.cycles(), 3 + 6);
    }

    #[test]
    fn reserved_page_bytes_still_unimplemented() {
        let mut machine = ready(0x0000, &[0x1A, 0x00]);
        assert!(matches!(
            machine.step(),
            Err(CoreError::UnimplementedOpcode {
                pc: 0,
                opcode: 0x1A
            })
        ));
        assert_eq!(machine.cpu().pc, 0);
        assert_eq!(machine.cpu().a, 0);
    }
}
