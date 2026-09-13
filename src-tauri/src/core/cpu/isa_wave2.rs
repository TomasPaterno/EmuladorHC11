//! Vectores de la ola 2: modos restantes, ALU B, word, RMW memoria, ASLD/LSRD, ABX/ABY.
//!
//! source_id: E5
//! section: 4.6, Table 4-2
//! printed_page: 80-87
//! pdf_page: 80-87
//! visual_review: true

#[cfg(test)]
mod tests {
    use crate::core::cpu::ccr::Ccr;
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
    fn andb_imm_clears_v() {
        let mut machine = ready(0x0000, &[0xC4, 0x0F]);
        machine.cpu_mut().b = 0xF3;
        machine.cpu_mut().ccr.v = true;
        machine.step().expect("ANDB");
        assert_eq!(machine.cpu().b, 0x03);
        assert_eq!(machine.cpu().pc, 0x0002);
        assert_eq!(machine.cycles(), 3 + 2);
        assert!(!machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.z);
    }

    #[test]
    fn cmpb_dir_and_bitb_ext() {
        let mut machine = ready(0x0000, &[0xD1, 0x20, 0xF5, 0x00, 0x21]);
        machine.cpu_mut().b = 0x10;
        machine.write_data_byte(0x0020, 0x20);
        machine.step().expect("CMPB DIR");
        assert_eq!(machine.cpu().b, 0x10);
        assert!(machine.cpu().ccr.n);
        assert!(machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.z);
        machine.write_data_byte(0x0021, 0xF0);
        machine.step().expect("BITB EXT");
        assert_eq!(machine.cpu().b, 0x10);
        assert!(!machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.z);
        assert!(!machine.cpu().ccr.v);
        assert_eq!(machine.cpu().pc, 0x0005);
    }

    #[test]
    fn eorb_indx_orab_indy() {
        let mut machine = ready(0x0000, &[0xE8, 0x02, 0x18, 0xEA, 0x01]);
        machine.cpu_mut().b = 0x0F;
        machine.cpu_mut().x = 0x0010;
        machine.cpu_mut().y = 0x0030;
        machine.write_data_byte(0x0012, 0xF0);
        machine.write_data_byte(0x0031, 0x80);
        machine.step().expect("EORB INDX");
        assert_eq!(machine.cpu().b, 0xFF);
        assert!(machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.v);
        machine.step().expect("ORAB INDY");
        assert_eq!(machine.cpu().b, 0xFF);
        assert_eq!(machine.cpu().pc, 0x0005);
        assert_eq!(machine.cycles(), 3 + 4 + 5);
    }

    #[test]
    fn adda_ext_and_subb_indx() {
        let mut machine = ready(0x0000, &[0xBB, 0x00, 0x40, 0xE0, 0x01]);
        machine.cpu_mut().a = 0x01;
        machine.cpu_mut().b = 0x10;
        machine.cpu_mut().x = 0x0050;
        machine.write_data_byte(0x0040, 0x02);
        machine.write_data_byte(0x0051, 0x01);
        machine.step().expect("ADDA EXT");
        assert_eq!(machine.cpu().a, 0x03);
        assert_eq!(machine.cpu().pc, 0x0003);
        assert_eq!(machine.cycles(), 3 + 4);
        machine.step().expect("SUBB INDX");
        assert_eq!(machine.cpu().b, 0x0F);
        assert!(!machine.cpu().ccr.c);
        assert_eq!(machine.cpu().pc, 0x0005);
    }

    #[test]
    fn subd_imm_borrow_and_overflow() {
        let mut machine = ready(0x0000, &[0x83, 0x00, 0x01]);
        machine.cpu_mut().set_d(0x0000);
        machine.cpu_mut().ccr.h = true;
        machine.step().expect("SUBD borrow");
        assert_eq!(machine.cpu().d(), 0xFFFF);
        assert_eq!(machine.cpu().pc, 0x0003);
        assert_eq!(machine.cycles(), 3 + 4);
        assert!(machine.cpu().ccr.n);
        assert!(machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.z);
        assert!(!machine.cpu().ccr.v);
        assert!(machine.cpu().ccr.h);

        let mut overflow = ready(0x0000, &[0x83, 0x00, 0x01]);
        overflow.cpu_mut().set_d(0x8000);
        overflow.step().expect("SUBD overflow");
        assert_eq!(overflow.cpu().d(), 0x7FFF);
        assert!(overflow.cpu().ccr.v);
        assert!(!overflow.cpu().ccr.c);
        assert!(!overflow.cpu().ccr.n);
    }

    #[test]
    fn cpd_imm_equal_sets_z() {
        let mut machine = ready(0x0000, &[0x1A, 0x83, 0x12, 0x34]);
        machine.cpu_mut().set_d(0x1234);
        machine.step().expect("CPD IMM");
        assert_eq!(machine.cpu().d(), 0x1234);
        assert_eq!(machine.cpu().pc, 0x0004);
        assert_eq!(machine.cycles(), 3 + 5);
        assert!(machine.cpu().ccr.z);
        assert!(!machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.v);
    }

    #[test]
    fn cpx_imm_overflow_leaves_x() {
        let mut machine = ready(0x0000, &[0x8C, 0x00, 0x01]);
        machine.cpu_mut().x = 0x8000;
        machine.step().expect("CPX IMM");
        assert_eq!(machine.cpu().x, 0x8000);
        assert_eq!(machine.cpu().pc, 0x0003);
        assert_eq!(machine.cycles(), 3 + 4);
        assert!(machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.z);
    }

    #[test]
    fn cpy_indx_and_cpx_indy() {
        let mut machine = ready(0x0000, &[0x1A, 0xAC, 0x02, 0xCD, 0xAC, 0x01]);
        machine.cpu_mut().y = 0x2000;
        machine.cpu_mut().x = 0x0010;
        machine.write_data_byte(0x0012, 0x20);
        machine.write_data_byte(0x0013, 0x00);
        machine.step().expect("CPY INDX");
        assert_eq!(machine.cpu().y, 0x2000);
        assert!(machine.cpu().ccr.z);
        machine.cpu_mut().x = 0x00AA;
        machine.cpu_mut().y = 0x0030;
        machine.write_data_byte(0x0031, 0x00);
        machine.write_data_byte(0x0032, 0xAB);
        machine.step().expect("CPX INDY");
        assert_eq!(machine.cpu().x, 0x00AA);
        assert!(machine.cpu().ccr.c);
        assert!(machine.cpu().ccr.n);
        assert_eq!(machine.cpu().pc, 0x0006);
        assert_eq!(machine.cycles(), 3 + 7 + 7);
    }

    #[test]
    fn abx_wraps_x_and_leaves_ccr() {
        let mut machine = ready(0x0000, &[0x3A]);
        machine.cpu_mut().x = 0xFFFF;
        machine.cpu_mut().b = 0x02;
        machine.cpu_mut().ccr = Ccr::from_bits(Ccr::H | Ccr::N | Ccr::C);
        machine.step().expect("ABX");
        assert_eq!(machine.cpu().x, 0x0001);
        assert_eq!(machine.cpu().b, 0x02);
        assert_eq!(machine.cpu().pc, 0x0001);
        assert_eq!(machine.cycles(), 3 + 3);
        assert!(machine.cpu().ccr.h);
        assert!(machine.cpu().ccr.n);
        assert!(machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.z);
        assert!(!machine.cpu().ccr.v);
    }

    #[test]
    fn aby_adds_b_to_y() {
        let mut machine = ready(0x0000, &[0x18, 0x3A]);
        machine.cpu_mut().y = 0x0100;
        machine.cpu_mut().b = 0x05;
        let ccr = machine.cpu().ccr;
        machine.step().expect("ABY");
        assert_eq!(machine.cpu().y, 0x0105);
        assert_eq!(machine.cpu().pc, 0x0002);
        assert_eq!(machine.cycles(), 3 + 4);
        assert_eq!(machine.cpu().ccr, ccr);
    }

    #[test]
    fn asl_ext_sets_c_from_bit7() {
        let mut machine = ready(0x0000, &[0x78, 0x00, 0x20]);
        machine.write_data_byte(0x0020, 0x80);
        machine.step().expect("ASL EXT");
        assert_eq!(machine.bus().read_byte(0x0020), 0x00);
        assert_eq!(machine.cpu().pc, 0x0003);
        assert_eq!(machine.cycles(), 3 + 6);
        assert!(machine.cpu().ccr.c);
        assert!(machine.cpu().ccr.z);
        assert!(machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.n);
    }

    #[test]
    fn lsr_indx_clears_n() {
        let mut machine = ready(0x0000, &[0x64, 0x03]);
        machine.cpu_mut().x = 0x0010;
        machine.write_data_byte(0x0013, 0x03);
        machine.step().expect("LSR INDX");
        assert_eq!(machine.bus().read_byte(0x0013), 0x01);
        assert_eq!(machine.cpu().pc, 0x0002);
        assert_eq!(machine.cycles(), 3 + 6);
        assert!(machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.z);
        assert!(machine.cpu().ccr.v);
    }

    #[test]
    fn ror_indy_uses_carry() {
        let mut machine = ready(0x0000, &[0x18, 0x66, 0x00]);
        machine.cpu_mut().y = 0x0040;
        machine.cpu_mut().ccr.c = true;
        machine.write_data_byte(0x0040, 0x02);
        machine.step().expect("ROR INDY");
        assert_eq!(machine.bus().read_byte(0x0040), 0x81);
        assert!(!machine.cpu().ccr.c);
        assert!(machine.cpu().ccr.n);
        assert_eq!(machine.cpu().pc, 0x0003);
        assert_eq!(machine.cycles(), 3 + 7);
    }

    #[test]
    fn neg_com_tst_memory() {
        let mut machine = ready(0x0000, &[0x70, 0x00, 0x20, 0x63, 0x01, 0x18, 0x6D, 0x00]);
        machine.write_data_byte(0x0020, 0x80);
        machine.cpu_mut().x = 0x0020;
        machine.cpu_mut().y = 0x0020;
        machine.step().expect("NEG EXT");
        assert_eq!(machine.bus().read_byte(0x0020), 0x80);
        assert!(machine.cpu().ccr.v);
        assert!(machine.cpu().ccr.c);
        assert!(machine.cpu().ccr.n);
        machine.write_data_byte(0x0021, 0x00);
        machine.step().expect("COM INDX");
        assert_eq!(machine.bus().read_byte(0x0021), 0xFF);
        assert!(machine.cpu().ccr.n);
        assert!(machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.v);
        machine.write_data_byte(0x0020, 0x00);
        machine.cpu_mut().ccr.c = true;
        machine.step().expect("TST INDY");
        assert_eq!(machine.bus().read_byte(0x0020), 0x00);
        assert!(machine.cpu().ccr.z);
        assert!(!machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.v);
        assert!(!machine.cpu().ccr.c);
        assert_eq!(machine.cpu().pc, 0x0008);
        assert_eq!(machine.cycles(), 3 + 6 + 6 + 7);
    }

    #[test]
    fn asld_shifts_d_and_sets_v_from_n_xor_c() {
        let mut machine = ready(0x0000, &[0x05]);
        machine.cpu_mut().set_d(0x8001);
        machine.step().expect("ASLD");
        assert_eq!(machine.cpu().d(), 0x0002);
        assert_eq!(machine.cpu().pc, 0x0001);
        assert_eq!(machine.cycles(), 3 + 3);
        assert!(machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.n);
        assert!(!machine.cpu().ccr.z);
        assert!(machine.cpu().ccr.v);
    }

    #[test]
    fn lsrd_takes_c_from_bit0() {
        let mut machine = ready(0x0000, &[0x04]);
        machine.cpu_mut().set_d(0x0001);
        machine.cpu_mut().ccr.n = true;
        machine.step().expect("LSRD");
        assert_eq!(machine.cpu().d(), 0x0000);
        assert_eq!(machine.cpu().pc, 0x0001);
        assert_eq!(machine.cycles(), 3 + 3);
        assert!(machine.cpu().ccr.c);
        assert!(!machine.cpu().ccr.n);
        assert!(machine.cpu().ccr.z);
        assert!(machine.cpu().ccr.v);
    }

    #[test]
    fn addd_indy_and_ldd_ext() {
        let mut machine = ready(0x0000, &[0x18, 0xE3, 0x02, 0xFC, 0x00, 0x50]);
        machine.cpu_mut().set_d(0x0001);
        machine.cpu_mut().y = 0x0030;
        machine.write_data_byte(0x0032, 0x00);
        machine.write_data_byte(0x0033, 0x02);
        machine.step().expect("ADDD INDY");
        assert_eq!(machine.cpu().d(), 0x0003);
        assert_eq!(machine.cpu().pc, 0x0003);
        assert_eq!(machine.cycles(), 3 + 7);
        machine.write_data_byte(0x0050, 0xAB);
        machine.write_data_byte(0x0051, 0xCD);
        machine.step().expect("LDD EXT");
        assert_eq!(machine.cpu().d(), 0xABCD);
        assert!(machine.cpu().ccr.n);
        assert_eq!(machine.cpu().pc, 0x0006);
    }

    #[test]
    fn stab_indx_and_stx_ext() {
        let mut machine = ready(0x0000, &[0xE7, 0x04, 0xFF, 0x00, 0x60]);
        machine.cpu_mut().b = 0x5A;
        machine.cpu_mut().x = 0x0010;
        machine.step().expect("STAB INDX");
        assert_eq!(machine.bus().read_byte(0x0014), 0x5A);
        assert_eq!(machine.cpu().pc, 0x0002);
        assert_eq!(machine.cycles(), 3 + 4);
        machine.cpu_mut().x = 0x1234;
        machine.step().expect("STX EXT");
        assert_eq!(machine.bus().read_byte(0x0060), 0x12);
        assert_eq!(machine.bus().read_byte(0x0061), 0x34);
        assert!(!machine.cpu().ccr.z);
        assert!(!machine.cpu().ccr.n);
        assert_eq!(machine.cpu().pc, 0x0005);
        assert_eq!(machine.cycles(), 3 + 4 + 5);
    }
}
