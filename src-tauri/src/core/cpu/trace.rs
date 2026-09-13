//! Resultado de un `step`: proyección para diffs, no semántica de CPU.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldChange {
    pub name: &'static str,
    pub from: u16,
    pub to: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemoryWrite {
    pub address: u16,
    pub old: u8,
    pub new: u8,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StepTrace {
    pub mnemonic: &'static str,
    pub opcode: u8,
    pub bytes: Vec<u8>,
    pub pc_before: u16,
    pub pc_after: u16,
    pub cycles_added: u64,
    pub registers: Vec<FieldChange>,
    pub ccr: Vec<FieldChange>,
    pub writes: Vec<MemoryWrite>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunStop {
    Limit,
    Unimplemented,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunOutcome {
    pub last_step: Option<StepTrace>,
    pub steps_taken: u32,
    pub stop: RunStop,
}
