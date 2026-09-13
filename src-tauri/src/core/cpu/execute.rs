//! Semántica de las olas 1–2 y laboratorio. Flags según E5 Table 4-2.
//!
//! source_id: E5
//! section: 4.6, Table 4-2
//! printed_page: 80-87
//! pdf_page: 80-87
//! visual_review: true

use super::super::memory::Bus;
use super::addressing::{read_operand8, read_operand16, rel_offset};
use super::ccr::Ccr;
use super::decode::{Acc, Branch, Decoded, Mode, Op, WordReg};
use super::registers::Registers;
use super::trace::MemoryWrite;

pub struct ExecCtx<'a> {
    pub cpu: &'a mut Registers,
    pub bus: &'a mut Bus,
    pub e_cycles: u64,
    pub writes: Vec<MemoryWrite>,
}

impl ExecCtx<'_> {
    fn acc(&self, which: Acc) -> u8 {
        match which {
            Acc::A => self.cpu.a,
            Acc::B => self.cpu.b,
        }
    }

    fn set_acc(&mut self, which: Acc, value: u8) {
        match which {
            Acc::A => self.cpu.a = value,
            Acc::B => self.cpu.b = value,
        }
    }

    fn write(&mut self, address: u16, new: u8) {
        let old = self.bus.read_byte(address);
        self.bus.write_byte(address, new, self.e_cycles);
        if old != new {
            self.writes.push(MemoryWrite { address, old, new });
        }
    }

    fn push(&mut self, value: u8) {
        self.write(self.cpu.sp, value);
        self.cpu.sp = self.cpu.sp.wrapping_sub(1);
    }

    fn pull(&mut self) -> u8 {
        self.cpu.sp = self.cpu.sp.wrapping_add(1);
        self.bus.read_byte(self.cpu.sp)
    }
}

pub fn execute(ctx: &mut ExecCtx<'_>, decoded: Decoded, start_pc: u16) {
    match decoded.op {
        Op::Nop => {}
        Op::Tab => {
            ctx.cpu.b = ctx.cpu.a;
            set_nzv0(&mut ctx.cpu.ccr, ctx.cpu.b);
        }
        Op::Tba => {
            ctx.cpu.a = ctx.cpu.b;
            set_nzv0(&mut ctx.cpu.ccr, ctx.cpu.a);
        }
        Op::Tap => tap(&mut ctx.cpu.ccr, ctx.cpu.a),
        Op::Tpa => ctx.cpu.a = ctx.cpu.ccr.bits(),
        Op::Tsx => ctx.cpu.x = ctx.cpu.sp.wrapping_add(1),
        Op::Txs => ctx.cpu.sp = ctx.cpu.x.wrapping_sub(1),
        Op::Tsy => ctx.cpu.y = ctx.cpu.sp.wrapping_add(1),
        Op::Tys => ctx.cpu.sp = ctx.cpu.y.wrapping_sub(1),
        Op::Xgdx => {
            let d = ctx.cpu.d();
            ctx.cpu.set_d(ctx.cpu.x);
            ctx.cpu.x = d;
        }
        Op::Xgdy => {
            let d = ctx.cpu.d();
            ctx.cpu.set_d(ctx.cpu.y);
            ctx.cpu.y = d;
        }
        Op::Psha => ctx.push(ctx.cpu.a),
        Op::Pshb => ctx.push(ctx.cpu.b),
        Op::Pula => ctx.cpu.a = ctx.pull(),
        Op::Pulb => ctx.cpu.b = ctx.pull(),
        Op::Pshx => {
            ctx.push(ctx.cpu.x as u8);
            ctx.push((ctx.cpu.x >> 8) as u8);
        }
        Op::Pulx => {
            let high = ctx.pull();
            let low = ctx.pull();
            ctx.cpu.x = u16::from(high) << 8 | u16::from(low);
        }
        Op::Pshy => {
            ctx.push(ctx.cpu.y as u8);
            ctx.push((ctx.cpu.y >> 8) as u8);
        }
        Op::Puly => {
            let high = ctx.pull();
            let low = ctx.pull();
            ctx.cpu.y = u16::from(high) << 8 | u16::from(low);
        }
        Op::Clc => ctx.cpu.ccr.c = false,
        Op::Sec => ctx.cpu.ccr.c = true,
        Op::Cli => ctx.cpu.ccr.i = false,
        Op::Sei => ctx.cpu.ccr.i = true,
        Op::Clv => ctx.cpu.ccr.v = false,
        Op::Sev => ctx.cpu.ccr.v = true,
        Op::Ins => ctx.cpu.sp = ctx.cpu.sp.wrapping_add(1),
        Op::Des => ctx.cpu.sp = ctx.cpu.sp.wrapping_sub(1),
        Op::Inx => {
            ctx.cpu.x = ctx.cpu.x.wrapping_add(1);
            ctx.cpu.ccr.z = ctx.cpu.x == 0;
        }
        Op::Dex => {
            ctx.cpu.x = ctx.cpu.x.wrapping_sub(1);
            ctx.cpu.ccr.z = ctx.cpu.x == 0;
        }
        Op::Iny => {
            ctx.cpu.y = ctx.cpu.y.wrapping_add(1);
            ctx.cpu.ccr.z = ctx.cpu.y == 0;
        }
        Op::Dey => {
            ctx.cpu.y = ctx.cpu.y.wrapping_sub(1);
            ctx.cpu.ccr.z = ctx.cpu.y == 0;
        }
        Op::Inc(acc) => {
            let value = inc8(ctx.acc(acc), &mut ctx.cpu.ccr);
            ctx.set_acc(acc, value);
        }
        Op::Dec(acc) => {
            let value = dec8(ctx.acc(acc), &mut ctx.cpu.ccr);
            ctx.set_acc(acc, value);
        }
        Op::DecMem(mode) => {
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let value = dec8(ctx.bus.read_byte(address), &mut ctx.cpu.ccr);
            ctx.write(address, value);
        }
        Op::IncMem(mode) => {
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let value = inc8(ctx.bus.read_byte(address), &mut ctx.cpu.ccr);
            ctx.write(address, value);
        }
        Op::ClrMem(mode) => {
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            ctx.write(address, 0);
            set_clr(&mut ctx.cpu.ccr);
        }
        Op::Clr(acc) => {
            ctx.set_acc(acc, 0);
            set_clr(&mut ctx.cpu.ccr);
        }
        Op::Com(acc) => {
            let value = !ctx.acc(acc);
            ctx.set_acc(acc, value);
            set_com(&mut ctx.cpu.ccr, value);
        }
        Op::Neg(acc) => {
            let value = neg8(ctx.acc(acc), &mut ctx.cpu.ccr);
            ctx.set_acc(acc, value);
        }
        Op::Asl(acc) => {
            let value = asl8(ctx.acc(acc), &mut ctx.cpu.ccr);
            ctx.set_acc(acc, value);
        }
        Op::Asr(acc) => {
            let value = asr8(ctx.acc(acc), &mut ctx.cpu.ccr);
            ctx.set_acc(acc, value);
        }
        Op::Lsr(acc) => {
            let value = lsr8(ctx.acc(acc), &mut ctx.cpu.ccr);
            ctx.set_acc(acc, value);
        }
        Op::Rol(acc) => {
            let value = rol8(ctx.acc(acc), ctx.cpu.ccr.c, &mut ctx.cpu.ccr);
            ctx.set_acc(acc, value);
        }
        Op::Ror(acc) => {
            let value = ror8(ctx.acc(acc), ctx.cpu.ccr.c, &mut ctx.cpu.ccr);
            ctx.set_acc(acc, value);
        }
        Op::Tst(acc) => {
            let value = ctx.acc(acc);
            set_tst(&mut ctx.cpu.ccr, value);
        }
        Op::ComMem(mode) => {
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let value = !ctx.bus.read_byte(address);
            ctx.write(address, value);
            set_com(&mut ctx.cpu.ccr, value);
        }
        Op::NegMem(mode) => {
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let value = neg8(ctx.bus.read_byte(address), &mut ctx.cpu.ccr);
            ctx.write(address, value);
        }
        Op::AslMem(mode) => rmw8(ctx, start_pc, decoded.prefix, mode, asl8),
        Op::AsrMem(mode) => rmw8(ctx, start_pc, decoded.prefix, mode, asr8),
        Op::LsrMem(mode) => rmw8(ctx, start_pc, decoded.prefix, mode, lsr8),
        Op::RolMem(mode) => rmw_rotate(ctx, start_pc, decoded.prefix, mode, rol8),
        Op::RorMem(mode) => rmw_rotate(ctx, start_pc, decoded.prefix, mode, ror8),
        Op::TstMem(mode) => {
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            set_tst(&mut ctx.cpu.ccr, ctx.bus.read_byte(address));
        }
        Op::Asld => {
            let d = ctx.cpu.d();
            ctx.cpu.ccr.c = d & 0x8000 != 0;
            let result = d << 1;
            ctx.cpu.set_d(result);
            finish_shift16(&mut ctx.cpu.ccr, result);
        }
        Op::Lsrd => {
            let d = ctx.cpu.d();
            ctx.cpu.ccr.c = d & 1 != 0;
            let result = d >> 1;
            ctx.cpu.set_d(result);
            ctx.cpu.ccr.n = false;
            ctx.cpu.ccr.z = result == 0;
            ctx.cpu.ccr.v = ctx.cpu.ccr.n ^ ctx.cpu.ccr.c;
        }
        Op::Abx => ctx.cpu.x = ctx.cpu.x.wrapping_add(u16::from(ctx.cpu.b)),
        Op::Aby => ctx.cpu.y = ctx.cpu.y.wrapping_add(u16::from(ctx.cpu.b)),
        Op::Aba => ctx.cpu.a = add8(ctx.cpu.a, ctx.cpu.b, false, &mut ctx.cpu.ccr),
        Op::Sba => ctx.cpu.a = sub8(ctx.cpu.a, ctx.cpu.b, false, true, &mut ctx.cpu.ccr),
        Op::Cba => {
            sub8(ctx.cpu.a, ctx.cpu.b, false, false, &mut ctx.cpu.ccr);
        }
        Op::Ld8(acc, mode) => {
            let value = read_operand8(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            ctx.set_acc(acc, value);
            set_nzv0(&mut ctx.cpu.ccr, value);
        }
        Op::Ld16(reg, mode) => {
            let value = read_operand16(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            match reg {
                WordReg::D => ctx.cpu.set_d(value),
                WordReg::X => ctx.cpu.x = value,
                WordReg::Y => ctx.cpu.y = value,
                WordReg::S => ctx.cpu.sp = value,
            }
            set_nzv0_16(&mut ctx.cpu.ccr, value);
        }
        Op::St8(acc, mode) => {
            let value = ctx.acc(acc);
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            ctx.write(address, value);
            set_nzv0(&mut ctx.cpu.ccr, value);
        }
        Op::St16(reg, mode) => {
            let value = match reg {
                WordReg::D => ctx.cpu.d(),
                WordReg::X => ctx.cpu.x,
                WordReg::Y => ctx.cpu.y,
                WordReg::S => ctx.cpu.sp,
            };
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            ctx.write(address, (value >> 8) as u8);
            ctx.write(address.wrapping_add(1), value as u8);
            set_nzv0_16(&mut ctx.cpu.ccr, value);
        }
        Op::Add8(acc, mode) => {
            let rhs = read_operand8(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let value = add8(ctx.acc(acc), rhs, false, &mut ctx.cpu.ccr);
            ctx.set_acc(acc, value);
        }
        Op::AddC8(acc, mode) => {
            let rhs = read_operand8(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let value = add8(ctx.acc(acc), rhs, ctx.cpu.ccr.c, &mut ctx.cpu.ccr);
            ctx.set_acc(acc, value);
        }
        Op::Add16(mode) => {
            let rhs = read_operand16(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let value = add16(ctx.cpu.d(), rhs, &mut ctx.cpu.ccr);
            ctx.cpu.set_d(value);
        }
        Op::Sub8(acc, mode) => {
            let rhs = read_operand8(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let value = sub8(ctx.acc(acc), rhs, false, true, &mut ctx.cpu.ccr);
            ctx.set_acc(acc, value);
        }
        Op::Sub16(mode) => {
            let rhs = read_operand16(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let value = sub16(ctx.cpu.d(), rhs, &mut ctx.cpu.ccr);
            ctx.cpu.set_d(value);
        }
        Op::Cmp16(reg, mode) => {
            let rhs = read_operand16(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let left = match reg {
                WordReg::D => ctx.cpu.d(),
                WordReg::X => ctx.cpu.x,
                WordReg::Y => ctx.cpu.y,
                WordReg::S => ctx.cpu.sp,
            };
            sub16(left, rhs, &mut ctx.cpu.ccr);
        }
        Op::And8(acc, mode) => logic(ctx, acc, mode, start_pc, decoded.prefix, |l, r| l & r),
        Op::Ora8(acc, mode) => logic(ctx, acc, mode, start_pc, decoded.prefix, |l, r| l | r),
        Op::Eor8(acc, mode) => logic(ctx, acc, mode, start_pc, decoded.prefix, |l, r| l ^ r),
        Op::Cmp8(acc, mode) => {
            let rhs = read_operand8(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            sub8(ctx.acc(acc), rhs, false, false, &mut ctx.cpu.ccr);
        }
        Op::Bit8(acc, mode) => {
            let rhs = read_operand8(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let value = ctx.acc(acc) & rhs;
            set_nzv0(&mut ctx.cpu.ccr, value);
        }
        Op::Bra(kind) => {
            let offset = rel_offset(ctx.bus, start_pc);
            if branch_taken(kind, &ctx.cpu.ccr) {
                ctx.cpu.pc = start_pc
                    .wrapping_add(2)
                    .wrapping_add(i16::from(offset) as u16);
                return;
            }
        }
        Op::Bsr => {
            let offset = rel_offset(ctx.bus, start_pc);
            let ret = start_pc.wrapping_add(2);
            ctx.push(ret as u8);
            ctx.push((ret >> 8) as u8);
            ctx.cpu.pc = ret.wrapping_add(i16::from(offset) as u16);
            return;
        }
        Op::Jmp(mode) => {
            ctx.cpu.pc = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            return;
        }
        Op::Jsr(mode) => {
            let dest = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let ret = start_pc.wrapping_add(decoded.bytes);
            ctx.push(ret as u8);
            ctx.push((ret >> 8) as u8);
            ctx.cpu.pc = dest;
            return;
        }
        Op::Rts => {
            let high = ctx.pull();
            let low = ctx.pull();
            ctx.cpu.pc = u16::from(high) << 8 | u16::from(low);
            return;
        }
        Op::Mul => {
            let a = ctx.cpu.a;
            let b = ctx.cpu.b;
            let product = u16::from(a) * u16::from(b);
            ctx.cpu.ccr.c = b & 0x80 != 0;
            ctx.cpu.set_d(product);
            ctx.cpu.ccr.n = product & 0x8000 != 0;
            ctx.cpu.ccr.z = product == 0;
        }
        Op::Bset(mode) => {
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let mask = bit_mask(ctx.bus, start_pc, decoded.prefix);
            let value = ctx.bus.read_byte(address) | mask;
            ctx.write(address, value);
            set_nzv0(&mut ctx.cpu.ccr, value);
        }
        Op::Bclr(mode) => {
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let mask = bit_mask(ctx.bus, start_pc, decoded.prefix);
            let value = ctx.bus.read_byte(address) & !mask;
            ctx.write(address, value);
            set_nzv0(&mut ctx.cpu.ccr, value);
        }
        Op::BrSet(mode) => {
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let mask = bit_mask(ctx.bus, start_pc, decoded.prefix);
            let value = ctx.bus.read_byte(address);
            if value & mask == mask {
                take_bit_branch(ctx, start_pc, decoded.bytes);
                return;
            }
        }
        Op::BrClr(mode) => {
            let address = store_address(ctx.cpu, ctx.bus, start_pc, decoded.prefix, mode);
            let mask = bit_mask(ctx.bus, start_pc, decoded.prefix);
            let value = ctx.bus.read_byte(address);
            if value & mask == 0 {
                take_bit_branch(ctx, start_pc, decoded.bytes);
                return;
            }
        }
    }
    ctx.cpu.pc = start_pc.wrapping_add(decoded.bytes);
}

fn rmw8(
    ctx: &mut ExecCtx<'_>,
    start_pc: u16,
    prefix: Option<u8>,
    mode: Mode,
    op: fn(u8, &mut Ccr) -> u8,
) {
    let address = store_address(ctx.cpu, ctx.bus, start_pc, prefix, mode);
    let value = op(ctx.bus.read_byte(address), &mut ctx.cpu.ccr);
    ctx.write(address, value);
}

fn rmw_rotate(
    ctx: &mut ExecCtx<'_>,
    start_pc: u16,
    prefix: Option<u8>,
    mode: Mode,
    op: fn(u8, bool, &mut Ccr) -> u8,
) {
    let address = store_address(ctx.cpu, ctx.bus, start_pc, prefix, mode);
    let carry = ctx.cpu.ccr.c;
    let value = op(ctx.bus.read_byte(address), carry, &mut ctx.cpu.ccr);
    ctx.write(address, value);
}

fn logic(
    ctx: &mut ExecCtx<'_>,
    acc: Acc,
    mode: Mode,
    start_pc: u16,
    prefix: Option<u8>,
    op: fn(u8, u8) -> u8,
) {
    let rhs = read_operand8(ctx.cpu, ctx.bus, start_pc, prefix, mode);
    let value = op(ctx.acc(acc), rhs);
    ctx.set_acc(acc, value);
    set_nzv0(&mut ctx.cpu.ccr, value);
}

fn store_address(cpu: &Registers, bus: &Bus, pc: u16, prefix: Option<u8>, mode: Mode) -> u16 {
    super::addressing::operand_address(cpu, bus, pc, prefix, mode)
}

fn bit_mask(bus: &Bus, pc: u16, prefix: Option<u8>) -> u8 {
    let base = pc.wrapping_add(if prefix.is_some() { 2 } else { 1 });
    bus.read_byte(base.wrapping_add(1))
}

fn take_bit_branch(ctx: &mut ExecCtx<'_>, start_pc: u16, bytes: u16) {
    let after = start_pc.wrapping_add(bytes);
    let offset = ctx.bus.read_byte(after.wrapping_sub(1)) as i8;
    ctx.cpu.pc = after.wrapping_add(i16::from(offset) as u16);
}

fn tap(ccr: &mut Ccr, a: u8) {
    let next = Ccr::from_bits(a);
    let x = ccr.x && next.x;
    *ccr = next;
    ccr.x = x;
}

fn set_nzv0(ccr: &mut Ccr, value: u8) {
    ccr.n = value & 0x80 != 0;
    ccr.z = value == 0;
    ccr.v = false;
}

fn set_nzv0_16(ccr: &mut Ccr, value: u16) {
    ccr.n = value & 0x8000 != 0;
    ccr.z = value == 0;
    ccr.v = false;
}

fn set_clr(ccr: &mut Ccr) {
    ccr.n = false;
    ccr.z = true;
    ccr.v = false;
    ccr.c = false;
}

fn set_com(ccr: &mut Ccr, value: u8) {
    ccr.n = value & 0x80 != 0;
    ccr.z = value == 0;
    ccr.v = false;
    ccr.c = true;
}

fn set_tst(ccr: &mut Ccr, value: u8) {
    ccr.n = value & 0x80 != 0;
    ccr.z = value == 0;
    ccr.v = false;
    ccr.c = false;
}

fn add8(left: u8, right: u8, carry: bool, ccr: &mut Ccr) -> u8 {
    let cin = u16::from(carry);
    let sum = u16::from(left) + u16::from(right) + cin;
    let result = sum as u8;
    ccr.h = ((left & 0x0F) + (right & 0x0F) + cin as u8) > 0x0F;
    ccr.n = result & 0x80 != 0;
    ccr.z = result == 0;
    ccr.v = ((left ^ result) & (right ^ result) & 0x80) != 0;
    ccr.c = sum > 0xFF;
    result
}

fn sub8(left: u8, right: u8, borrow: bool, update_h: bool, ccr: &mut Ccr) -> u8 {
    let bin = u16::from(borrow);
    let diff = u16::from(left)
        .wrapping_sub(u16::from(right))
        .wrapping_sub(bin);
    let result = diff as u8;
    if update_h {
        ccr.h = (left & 0x0F) < (right & 0x0F) + u8::from(borrow);
    }
    ccr.n = result & 0x80 != 0;
    ccr.z = result == 0;
    ccr.v = ((left ^ right) & (left ^ result) & 0x80) != 0;
    ccr.c = u16::from(left) < u16::from(right) + bin;
    result
}

fn add16(left: u16, right: u16, ccr: &mut Ccr) -> u16 {
    let sum = u32::from(left) + u32::from(right);
    let result = sum as u16;
    ccr.n = result & 0x8000 != 0;
    ccr.z = result == 0;
    ccr.v = ((left ^ result) & (right ^ result) & 0x8000) != 0;
    ccr.c = sum > 0xFFFF;
    result
}

fn sub16(left: u16, right: u16, ccr: &mut Ccr) -> u16 {
    let result = left.wrapping_sub(right);
    ccr.n = result & 0x8000 != 0;
    ccr.z = result == 0;
    ccr.v = ((left ^ right) & (left ^ result) & 0x8000) != 0;
    ccr.c = left < right;
    result
}

fn inc8(value: u8, ccr: &mut Ccr) -> u8 {
    let result = value.wrapping_add(1);
    ccr.n = result & 0x80 != 0;
    ccr.z = result == 0;
    ccr.v = value == 0x7F;
    result
}

fn dec8(value: u8, ccr: &mut Ccr) -> u8 {
    let result = value.wrapping_sub(1);
    ccr.n = result & 0x80 != 0;
    ccr.z = result == 0;
    ccr.v = value == 0x80;
    result
}

fn neg8(value: u8, ccr: &mut Ccr) -> u8 {
    let result = value.wrapping_neg();
    ccr.n = result & 0x80 != 0;
    ccr.z = result == 0;
    ccr.v = value == 0x80;
    ccr.c = result != 0;
    result
}

fn asl8(value: u8, ccr: &mut Ccr) -> u8 {
    ccr.c = value & 0x80 != 0;
    let result = value << 1;
    finish_shift(ccr, result)
}

fn asr8(value: u8, ccr: &mut Ccr) -> u8 {
    ccr.c = value & 0x01 != 0;
    let result = (value >> 1) | (value & 0x80);
    finish_shift(ccr, result)
}

fn lsr8(value: u8, ccr: &mut Ccr) -> u8 {
    ccr.c = value & 0x01 != 0;
    let result = value >> 1;
    finish_shift(ccr, result)
}

fn rol8(value: u8, carry: bool, ccr: &mut Ccr) -> u8 {
    let result = value << 1 | u8::from(carry);
    ccr.c = value & 0x80 != 0;
    finish_shift(ccr, result)
}

fn ror8(value: u8, carry: bool, ccr: &mut Ccr) -> u8 {
    let result = value >> 1 | if carry { 0x80 } else { 0 };
    ccr.c = value & 0x01 != 0;
    finish_shift(ccr, result)
}

fn finish_shift(ccr: &mut Ccr, result: u8) -> u8 {
    ccr.n = result & 0x80 != 0;
    ccr.z = result == 0;
    ccr.v = ccr.n ^ ccr.c;
    result
}

fn finish_shift16(ccr: &mut Ccr, result: u16) {
    ccr.n = result & 0x8000 != 0;
    ccr.z = result == 0;
    ccr.v = ccr.n ^ ccr.c;
}

fn branch_taken(kind: Branch, ccr: &Ccr) -> bool {
    match kind {
        Branch::Always => true,
        Branch::Eq => ccr.z,
        Branch::Ne => !ccr.z,
        Branch::Cc => !ccr.c,
        Branch::Cs => ccr.c,
        Branch::Mi => ccr.n,
        Branch::Pl => !ccr.n,
        Branch::Hi => !ccr.c && !ccr.z,
        Branch::Ls => ccr.c || ccr.z,
        Branch::Ge => ccr.n == ccr.v,
        Branch::Lt => ccr.n != ccr.v,
        Branch::Gt => !ccr.z && ccr.n == ccr.v,
        Branch::Le => ccr.z || ccr.n != ccr.v,
    }
}
