//! Máquina determinista: reset, step y carga explícita.

use super::cpu::Registers;
use super::cpu::decode::decode;
use super::cpu::execute::{ExecCtx, execute};
use super::cpu::trace::{FieldChange, RunOutcome, RunStop, StepTrace};
use super::error::CoreError;
use super::memory::Bus;
use super::variant::Profile;

pub const MAX_LOAD_BYTES: usize = 4096;
pub const MAX_IMAGE_BYTES: usize = 16 * 1024;
pub const MEMORY_WINDOW_BYTES: u16 = 16;
pub const MEMORY_VIEW_BYTES: u16 = 256;
pub const MAX_RUN_STEPS: u32 = 10_000;

#[derive(Debug, Clone)]
pub struct Machine {
    cpu: Registers,
    bus: Bus,
    cycles: u64,
}

impl Machine {
    pub fn new_e9() -> Self {
        let mut machine = Self {
            cpu: Registers::after_reset(0),
            bus: Bus::new_e9(),
            cycles: 0,
        };
        machine.reset();
        machine
    }

    pub fn cpu(&self) -> &Registers {
        &self.cpu
    }

    #[cfg(test)]
    pub fn cpu_mut(&mut self) -> &mut Registers {
        &mut self.cpu
    }

    pub fn bus(&self) -> &Bus {
        &self.bus
    }

    pub fn cycles(&self) -> u64 {
        self.cycles
    }

    pub fn profile(&self) -> Profile {
        self.bus.profile()
    }

    /// Reset de modo normal (POR / pin RESET).
    ///
    /// source_id: E5
    /// section: 5.3.1-5.3.2, Table 5-2, Table 5-4
    /// printed_page: 93-94, 99
    /// pdf_page: 93-94, 99
    /// visual_review: true
    pub fn reset(&mut self) {
        self.bus.reset_map();
        self.cycles = self.profile().reset_vector_fetch_cycles;
        let pc = self.bus.read_word(self.profile().reset_vector);
        self.cpu = Registers::after_reset(pc);
    }

    pub fn set_pc(&mut self, pc: u16) {
        self.cpu.pc = pc;
    }

    pub fn inspect_memory(&self, start: u16, length: u16) -> Result<Vec<u8>, CoreError> {
        if length == 0 || length > MEMORY_VIEW_BYTES {
            return Err(CoreError::InspectTooLarge {
                length: usize::from(length),
            });
        }
        Ok((0..length)
            .map(|offset| self.bus.read_byte(start.wrapping_add(offset)))
            .collect())
    }

    pub fn aligned_view_start(pc: u16) -> u16 {
        pc & !0x00FF
    }

    pub fn step(&mut self) -> Result<StepTrace, CoreError> {
        let pc = self.cpu.pc;
        let decoded = decode(&self.bus, pc)?;
        let before = self.cpu.clone();
        let bytes: Vec<u8> = (0..decoded.bytes)
            .map(|offset| self.bus.read_byte(pc.wrapping_add(offset)))
            .collect();
        let mut ctx = ExecCtx {
            cpu: &mut self.cpu,
            bus: &mut self.bus,
            e_cycles: self.cycles,
            writes: Vec::new(),
        };
        execute(&mut ctx, decoded, pc);
        let writes = ctx.writes;
        self.cycles = self.cycles.saturating_add(decoded.cycles);
        Ok(build_trace(
            decoded.mnemonic,
            decoded.opcode,
            bytes,
            &before,
            &self.cpu,
            decoded.cycles,
            writes,
        ))
    }

    pub fn run(&mut self, max_steps: u32) -> Result<RunOutcome, CoreError> {
        if max_steps == 0 || max_steps > MAX_RUN_STEPS {
            return Err(CoreError::InvalidRunLimit { max_steps });
        }
        let mut last_step = None;
        let mut steps_taken = 0;
        for _ in 0..max_steps {
            match self.step() {
                Ok(trace) => {
                    last_step = Some(trace);
                    steps_taken += 1;
                }
                Err(CoreError::UnimplementedOpcode { .. }) => {
                    return Ok(RunOutcome {
                        last_step,
                        steps_taken,
                        stop: RunStop::Unimplemented,
                    });
                }
                Err(error) => return Err(error),
            }
        }
        Ok(RunOutcome {
            last_step,
            steps_taken,
            stop: RunStop::Limit,
        })
    }

    pub fn load_bytes(&mut self, start: u16, data: &[u8]) -> Result<(), CoreError> {
        if data.len() > MAX_LOAD_BYTES {
            return Err(CoreError::LoadTooLarge { length: data.len() });
        }
        let end = u32::from(start).saturating_add(data.len() as u32);
        if end > 0x1_0000 {
            return Err(CoreError::LoadOutOfRange {
                start,
                length: data.len(),
            });
        }
        for (index, value) in data.iter().enumerate() {
            let address = start + index as u16;
            self.bus.load_byte(address, *value)?;
        }
        Ok(())
    }

    pub fn load_image(&mut self, bytes: &[(u16, u8)]) -> Result<(), CoreError> {
        if bytes.len() > MAX_IMAGE_BYTES {
            return Err(CoreError::LoadTooLarge {
                length: bytes.len(),
            });
        }
        let mut next = self.clone();
        for &(address, value) in bytes {
            next.bus.load_byte(address, value)?;
        }
        *self = next;
        Ok(())
    }

    pub fn write_data_byte(&mut self, address: u16, value: u8) {
        self.bus.write_byte(address, value, self.cycles);
    }

    pub fn memory_window(&self) -> (u16, Vec<u8>) {
        let start = self.cpu.pc;
        let bytes = (0..MEMORY_WINDOW_BYTES)
            .map(|offset| self.bus.read_byte(start.wrapping_add(offset)))
            .collect();
        (start, bytes)
    }
}

fn build_trace(
    mnemonic: &'static str,
    opcode: u8,
    bytes: Vec<u8>,
    before: &Registers,
    after: &Registers,
    cycles_added: u64,
    writes: Vec<super::cpu::trace::MemoryWrite>,
) -> StepTrace {
    let mut registers = Vec::new();
    push_change(&mut registers, "A", u16::from(before.a), u16::from(after.a));
    push_change(&mut registers, "B", u16::from(before.b), u16::from(after.b));
    push_change(&mut registers, "D", before.d(), after.d());
    push_change(&mut registers, "X", before.x, after.x);
    push_change(&mut registers, "Y", before.y, after.y);
    push_change(&mut registers, "SP", before.sp, after.sp);
    push_change(&mut registers, "PC", before.pc, after.pc);
    let mut ccr = Vec::new();
    push_flag(&mut ccr, "S", before.ccr.s, after.ccr.s);
    push_flag(&mut ccr, "X", before.ccr.x, after.ccr.x);
    push_flag(&mut ccr, "H", before.ccr.h, after.ccr.h);
    push_flag(&mut ccr, "I", before.ccr.i, after.ccr.i);
    push_flag(&mut ccr, "N", before.ccr.n, after.ccr.n);
    push_flag(&mut ccr, "Z", before.ccr.z, after.ccr.z);
    push_flag(&mut ccr, "V", before.ccr.v, after.ccr.v);
    push_flag(&mut ccr, "C", before.ccr.c, after.ccr.c);
    StepTrace {
        mnemonic,
        opcode,
        bytes,
        pc_before: before.pc,
        pc_after: after.pc,
        cycles_added,
        registers,
        ccr,
        writes,
    }
}

fn push_change(out: &mut Vec<FieldChange>, name: &'static str, from: u16, to: u16) {
    if from != to {
        out.push(FieldChange { name, from, to });
    }
}

fn push_flag(out: &mut Vec<FieldChange>, name: &'static str, from: bool, to: bool) {
    if from != to {
        out.push(FieldChange {
            name,
            from: u16::from(from),
            to: u16::from(to),
        });
    }
}

#[cfg(test)]
mod tests {
    const NOP_OPCODE: u8 = 0x01;

    use super::Machine;
    use crate::core::cpu::ccr::Ccr;
    use crate::core::error::CoreError;

    fn machine_with_reset_vector(pc: u16) -> Machine {
        let mut machine = Machine::new_e9();
        machine
            .load_bytes(0xFFFE, &[(pc >> 8) as u8, pc as u8])
            .expect("vector en ROM");
        machine.reset();
        machine
    }

    #[test]
    fn reset_loads_normal_vector_and_sets_ccr_masks() {
        let machine = machine_with_reset_vector(0xD000);
        assert_eq!(machine.cpu().pc, 0xD000);
        assert_eq!(machine.bus().init_value(), 0x01);
        assert_eq!(machine.cpu().ccr.bits(), Ccr::S | Ccr::X | Ccr::I);
        assert_eq!(machine.cycles(), 3);
    }

    #[test]
    fn nop_advances_pc_and_cycles_without_touching_ccr() {
        let mut machine = machine_with_reset_vector(0x0000);
        machine.load_bytes(0x0000, &[NOP_OPCODE]).expect("RAM");
        machine.reset();
        let ccr = machine.cpu().ccr;
        machine.step().expect("NOP");
        assert_eq!(machine.cpu().pc, 0x0001);
        assert_eq!(machine.cycles(), 5);
        assert_eq!(machine.cpu().ccr, ccr);
    }

    #[test]
    fn unknown_opcode_leaves_state_intact() {
        let mut machine = machine_with_reset_vector(0x0000);
        machine.load_bytes(0x0000, &[0xFF]).expect("RAM");
        machine.reset();
        let before = machine.clone();
        let error = machine.step().expect_err("opcode desconocido");
        assert_eq!(
            error,
            CoreError::UnimplementedOpcode {
                pc: 0x0000,
                opcode: 0xFF
            }
        );
        assert_eq!(machine.cpu().pc, before.cpu().pc);
        assert_eq!(machine.cycles(), before.cycles());
        assert_eq!(machine.cpu().ccr, before.cpu().ccr);
    }

    #[test]
    fn init_rejected_after_sixty_four_cycles() {
        let mut machine = machine_with_reset_vector(0x0000);
        machine.load_bytes(0x0000, &[NOP_OPCODE; 40]).expect("RAM");
        machine.reset();
        while machine.cycles() < 64 {
            machine.step().expect("NOP");
        }
        machine.write_data_byte(0x103D, 0x22);
        assert_eq!(machine.bus().init_value(), 0x01);
        assert_eq!(machine.bus().ram_base(), 0x0000);
    }

    #[test]
    fn load_past_64k_is_error() {
        let mut machine = Machine::new_e9();
        let error = machine
            .load_bytes(0xFFF0, &[0; 17])
            .expect_err("fuera de rango");
        assert!(matches!(
            error,
            CoreError::LoadOutOfRange {
                start: 0xFFF0,
                length: 17
            }
        ));
    }

    #[test]
    fn load_image_writes_rom_and_reset_vector() {
        let mut machine = Machine::new_e9();
        machine
            .load_image(&[(0xD000, NOP_OPCODE), (0xFFFE, 0xD0), (0xFFFF, 0x00)])
            .expect("ROM y vector");
        assert_eq!(machine.bus().read_byte(0xD000), NOP_OPCODE);
        assert_eq!(machine.bus().read_word(0xFFFE), 0xD000);
    }

    #[test]
    fn load_image_rejects_register_block() {
        let mut machine = Machine::new_e9();
        let error = machine
            .load_image(&[(0xD000, NOP_OPCODE), (0x1000, 0xAA)])
            .expect_err("registro");
        assert_eq!(error, CoreError::LoadRejected { address: 0x1000 });
        assert_eq!(machine.bus().read_byte(0xD000), 0xFF);
    }
}
