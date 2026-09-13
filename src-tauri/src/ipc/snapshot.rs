use serde::Serialize;

use crate::core::Machine;
use crate::core::cpu::trace::{FieldChange, MemoryWrite, RunOutcome, RunStop, StepTrace};
use crate::core::machine::{MEMORY_VIEW_BYTES, MEMORY_WINDOW_BYTES};

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcrFlags {
    pub s: bool,
    pub x: bool,
    pub h: bool,
    pub i: bool,
    pub n: bool,
    pub z: bool,
    pub v: bool,
    pub c: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryWindow {
    pub start: u16,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuSnapshot {
    pub schema_version: u32,
    pub variant: String,
    pub a: u8,
    pub b: u8,
    pub d: u16,
    pub x: u16,
    pub y: u16,
    pub sp: u16,
    pub pc: u16,
    pub ccr: u8,
    pub ccr_flags: CcrFlags,
    pub cycles: u64,
    pub init: u8,
    pub memory_window: MemoryWindow,
}

impl From<&Machine> for CpuSnapshot {
    fn from(machine: &Machine) -> Self {
        let cpu = machine.cpu();
        let (start, bytes) = machine.memory_window();
        debug_assert_eq!(bytes.len(), usize::from(MEMORY_WINDOW_BYTES));
        Self {
            schema_version: SCHEMA_VERSION,
            variant: machine.profile().id.to_string(),
            a: cpu.a,
            b: cpu.b,
            d: cpu.d(),
            x: cpu.x,
            y: cpu.y,
            sp: cpu.sp,
            pc: cpu.pc,
            ccr: cpu.ccr.bits(),
            ccr_flags: CcrFlags {
                s: cpu.ccr.s,
                x: cpu.ccr.x,
                h: cpu.ccr.h,
                i: cpu.ccr.i,
                n: cpu.ccr.n,
                z: cpu.ccr.z,
                v: cpu.ccr.v,
                c: cpu.ccr.c,
            },
            cycles: machine.cycles(),
            init: machine.bus().init_value(),
            memory_window: MemoryWindow { start, bytes },
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldChangeDto {
    pub name: String,
    pub from: u16,
    pub to: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryWriteDto {
    pub address: u16,
    pub old: u8,
    pub new: u8,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastStepDto {
    pub mnemonic: String,
    pub opcode: u8,
    pub bytes: Vec<u8>,
    pub pc_before: u16,
    pub pc_after: u16,
    pub cycles_added: u64,
    pub registers: Vec<FieldChangeDto>,
    pub ccr: Vec<FieldChangeDto>,
    pub writes: Vec<MemoryWriteDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryViewDto {
    pub start: u16,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunInfoDto {
    pub steps_taken: u32,
    pub stop_reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionResult {
    pub snapshot: CpuSnapshot,
    pub last_step: Option<LastStepDto>,
    pub memory_view: MemoryViewDto,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run: Option<RunInfoDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteMemoryResult {
    pub snapshot: CpuSnapshot,
    pub memory_view: MemoryViewDto,
}

impl From<&FieldChange> for FieldChangeDto {
    fn from(change: &FieldChange) -> Self {
        Self {
            name: change.name.to_string(),
            from: change.from,
            to: change.to,
        }
    }
}

impl From<&MemoryWrite> for MemoryWriteDto {
    fn from(write: &MemoryWrite) -> Self {
        Self {
            address: write.address,
            old: write.old,
            new: write.new,
        }
    }
}

impl From<&StepTrace> for LastStepDto {
    fn from(trace: &StepTrace) -> Self {
        Self {
            mnemonic: trace.mnemonic.to_string(),
            opcode: trace.opcode,
            bytes: trace.bytes.clone(),
            pc_before: trace.pc_before,
            pc_after: trace.pc_after,
            cycles_added: trace.cycles_added,
            registers: trace.registers.iter().map(FieldChangeDto::from).collect(),
            ccr: trace.ccr.iter().map(FieldChangeDto::from).collect(),
            writes: trace.writes.iter().map(MemoryWriteDto::from).collect(),
        }
    }
}

impl From<&RunStop> for String {
    fn from(stop: &RunStop) -> Self {
        match stop {
            RunStop::Limit => "limit".to_string(),
            RunStop::Unimplemented => "unimplemented".to_string(),
        }
    }
}

pub fn memory_view_for(
    machine: &Machine,
    window_start: Option<u16>,
) -> Result<MemoryViewDto, crate::core::CoreError> {
    let start = window_start.unwrap_or_else(|| Machine::aligned_view_start(machine.cpu().pc));
    let bytes = machine.inspect_memory(start, MEMORY_VIEW_BYTES)?;
    Ok(MemoryViewDto { start, bytes })
}

pub fn execution_result(
    machine: &Machine,
    last_step: Option<&StepTrace>,
    window_start: Option<u16>,
    run: Option<&RunOutcome>,
) -> Result<ExecutionResult, crate::core::CoreError> {
    Ok(ExecutionResult {
        snapshot: CpuSnapshot::from(machine),
        last_step: last_step.map(LastStepDto::from),
        memory_view: memory_view_for(machine, window_start)?,
        run: run.map(|outcome| RunInfoDto {
            steps_taken: outcome.steps_taken,
            stop_reason: String::from(&outcome.stop),
        }),
    })
}
