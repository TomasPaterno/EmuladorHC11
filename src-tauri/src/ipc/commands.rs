use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

use crate::core::{CoreError, Machine};

use super::listing::{self, ListingError, ListingSummary, ParsedListing};
use super::s19::{self, ParsedS19, S19Error, S19Summary};
use super::snapshot::{
    CpuSnapshot, ExecutionResult, MemoryViewDto, WriteMemoryResult, execution_result,
    memory_view_for,
};

pub const MAX_LOAD_BYTES: usize = crate::core::machine::MAX_LOAD_BYTES;

pub struct AppState(pub Mutex<Machine>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddressRangeDto {
    pub start: u16,
    pub end: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadSummary {
    pub record_count: u32,
    pub bytes_loaded: u32,
    pub ranges: Vec<AddressRangeDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadS19Result {
    pub snapshot: CpuSnapshot,
    pub summary: LoadSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListingSummaryDto {
    pub record_count: u32,
    pub bytes_loaded: u32,
    pub ranges: Vec<AddressRangeDto>,
    pub entry: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadListingResult {
    pub snapshot: CpuSnapshot,
    pub summary: ListingSummaryDto,
}

impl From<CoreError> for IpcError {
    fn from(error: CoreError) -> Self {
        Self {
            code: error.code().to_string(),
            message: error.to_string(),
        }
    }
}

impl From<S19Error> for IpcError {
    fn from(error: S19Error) -> Self {
        Self {
            code: error.code().to_string(),
            message: error.to_string(),
        }
    }
}

impl From<ListingError> for IpcError {
    fn from(error: ListingError) -> Self {
        Self {
            code: error.code().to_string(),
            message: error.to_string(),
        }
    }
}

impl From<&ListingSummary> for ListingSummaryDto {
    fn from(summary: &ListingSummary) -> Self {
        Self {
            record_count: summary.record_count,
            bytes_loaded: summary.bytes_loaded,
            ranges: summary
                .ranges
                .iter()
                .map(|range| AddressRangeDto {
                    start: range.start,
                    end: range.end,
                })
                .collect(),
            entry: summary.entry,
        }
    }
}

impl From<&S19Summary> for LoadSummary {
    fn from(summary: &S19Summary) -> Self {
        Self {
            record_count: summary.record_count,
            bytes_loaded: summary.bytes_loaded,
            ranges: summary
                .ranges
                .iter()
                .map(|range| AddressRangeDto {
                    start: range.start,
                    end: range.end,
                })
                .collect(),
        }
    }
}

fn lock_machine(state: &AppState) -> Result<std::sync::MutexGuard<'_, Machine>, IpcError> {
    state.0.lock().map_err(|_| IpcError {
        code: "unavailable".to_string(),
        message: "el núcleo no está disponible".to_string(),
    })
}

fn apply_s19(machine: &mut Machine, contents: &str) -> Result<LoadS19Result, IpcError> {
    if contents.len() > s19::MAX_S19_TEXT_BYTES {
        return Err(S19Error::TooLarge {
            length: contents.len(),
        }
        .into());
    }
    let parsed: ParsedS19 = s19::parse_s19(contents)?;
    machine.load_image(&parsed.bytes)?;
    machine.reset();
    Ok(LoadS19Result {
        snapshot: CpuSnapshot::from(&*machine),
        summary: LoadSummary::from(&parsed.summary),
    })
}

fn apply_listing(machine: &mut Machine, contents: &str) -> Result<LoadListingResult, IpcError> {
    if contents.len() > listing::MAX_LISTING_TEXT_BYTES {
        return Err(ListingError::TooLarge {
            length: contents.len(),
        }
        .into());
    }
    let parsed: ParsedListing = listing::parse_listing(contents)?;
    machine.load_image(&parsed.bytes)?;
    machine.reset();
    machine.set_pc(parsed.summary.entry);
    Ok(LoadListingResult {
        snapshot: CpuSnapshot::from(&*machine),
        summary: ListingSummaryDto::from(&parsed.summary),
    })
}

#[tauri::command]
pub fn reset(state: State<AppState>) -> Result<CpuSnapshot, IpcError> {
    let mut machine = lock_machine(&state)?;
    machine.reset();
    Ok(CpuSnapshot::from(&*machine))
}

#[tauri::command]
pub fn step(
    state: State<AppState>,
    window_start: Option<u16>,
) -> Result<ExecutionResult, IpcError> {
    let mut machine = lock_machine(&state)?;
    let last_step = machine.step()?;
    Ok(execution_result(
        &machine,
        Some(&last_step),
        window_start,
        None,
    )?)
}

#[tauri::command]
pub fn run(
    state: State<AppState>,
    max_steps: u32,
    window_start: Option<u16>,
) -> Result<ExecutionResult, IpcError> {
    let mut machine = lock_machine(&state)?;
    let outcome = machine.run(max_steps)?;
    Ok(execution_result(
        &machine,
        outcome.last_step.as_ref(),
        window_start,
        Some(&outcome),
    )?)
}

#[tauri::command]
pub fn inspect_memory(
    state: State<AppState>,
    start: u16,
    length: u16,
) -> Result<MemoryViewDto, IpcError> {
    let machine = lock_machine(&state)?;
    if length == crate::core::machine::MEMORY_VIEW_BYTES {
        return Ok(memory_view_for(&machine, Some(start))?);
    }
    Ok(MemoryViewDto {
        start,
        bytes: machine.inspect_memory(start, length)?,
    })
}

#[tauri::command]
pub fn write_memory(
    state: State<AppState>,
    address: u16,
    value: u8,
    window_start: Option<u16>,
) -> Result<WriteMemoryResult, IpcError> {
    let mut machine = lock_machine(&state)?;
    apply_write_memory(&mut machine, address, value, window_start)
}

fn apply_write_memory(
    machine: &mut Machine,
    address: u16,
    value: u8,
    window_start: Option<u16>,
) -> Result<WriteMemoryResult, IpcError> {
    machine.write_data_byte(address, value);
    if machine.bus().read_byte(address) != value {
        return Err(IpcError {
            code: "write_ignored".to_string(),
            message: "la escritura no modificó esa dirección".to_string(),
        });
    }
    Ok(WriteMemoryResult {
        snapshot: CpuSnapshot::from(&*machine),
        memory_view: memory_view_for(machine, window_start)?,
    })
}

#[tauri::command]
pub fn load_bytes(
    state: State<AppState>,
    start: u16,
    data: Vec<u8>,
) -> Result<CpuSnapshot, IpcError> {
    if data.len() > MAX_LOAD_BYTES {
        return Err(CoreError::LoadTooLarge { length: data.len() }.into());
    }
    let mut machine = lock_machine(&state)?;
    machine.load_bytes(start, &data)?;
    Ok(CpuSnapshot::from(&*machine))
}

#[tauri::command]
pub fn load_s19(state: State<AppState>, contents: String) -> Result<LoadS19Result, IpcError> {
    let mut machine = lock_machine(&state)?;
    apply_s19(&mut machine, &contents)
}

#[tauri::command]
pub fn load_listing(
    state: State<AppState>,
    contents: String,
) -> Result<LoadListingResult, IpcError> {
    let mut machine = lock_machine(&state)?;
    apply_listing(&mut machine, &contents)
}

#[cfg(test)]
mod tests {
    use super::{IpcError, apply_listing, apply_s19, apply_write_memory};
    use crate::core::Machine;
    use crate::ipc::s19::checksum_ok;

    fn record(kind: char, bytes: &[u8]) -> String {
        let count = bytes.len() as u8 + 1;
        let mut payload = Vec::with_capacity(bytes.len() + 2);
        payload.push(count);
        payload.extend_from_slice(bytes);
        let sum = payload
            .iter()
            .fold(0_u8, |acc, byte| acc.wrapping_add(*byte));
        payload.push(!sum);
        debug_assert!(checksum_ok(&payload));
        let mut line = format!("S{kind}");
        for byte in payload {
            line.push_str(&format!("{byte:02X}"));
        }
        line
    }

    #[test]
    fn load_s19_resets_pc_from_vector() {
        let contents = [
            record('1', &[0xD0, 0x00, 0x01]),
            record('1', &[0xFF, 0xFE, 0xD0, 0x00]),
            record('9', &[0x12, 0x34]),
        ]
        .join("\n");
        let mut machine = Machine::new_e9();
        let result = apply_s19(&mut machine, &contents).expect("S19");
        assert_eq!(result.snapshot.pc, 0xD000);
        assert_eq!(result.snapshot.cycles, 3);
        assert_eq!(result.summary.bytes_loaded, 3);
        assert_eq!(machine.cpu().pc, 0xD000);
        assert_eq!(machine.bus().read_byte(0xD000), 0x01);
    }

    #[test]
    fn load_s19_error_does_not_include_payload() {
        let contents = "S104D0000100\nSECRET=ROMDUMP";
        let error: IpcError = apply_s19(&mut Machine::new_e9(), contents).expect_err("checksum");
        assert_eq!(error.code, "s19_checksum");
        assert!(!error.message.contains("SECRET"));
        assert!(!error.message.contains("D000"));
    }

    #[test]
    fn step_result_includes_trace_and_aligned_view() {
        use crate::ipc::snapshot::execution_result;

        let mut machine = Machine::new_e9();
        machine.load_bytes(0xFFFE, &[0x00, 0x00]).expect("vector");
        machine.load_bytes(0x0000, &[0x01]).expect("NOP");
        machine.reset();
        let trace = machine.step().expect("step");
        let result = execution_result(&machine, Some(&trace), None, None).expect("dto");
        assert_eq!(
            result.last_step.as_ref().map(|step| step.mnemonic.as_str()),
            Some("NOP")
        );
        assert_eq!(result.memory_view.start, 0x0000);
        assert_eq!(result.memory_view.bytes.len(), 256);
        assert!(result.run.is_none());
    }

    #[test]
    fn run_limit_and_inspect_errors() {
        use crate::core::cpu::trace::RunStop;
        use crate::core::error::CoreError;

        let mut machine = Machine::new_e9();
        machine.load_bytes(0xFFFE, &[0x00, 0x00]).expect("vector");
        machine.load_bytes(0x0000, &[0x01; 8]).expect("NOPs");
        machine.reset();
        let outcome = machine.run(3).expect("run");
        assert_eq!(outcome.steps_taken, 3);
        assert_eq!(outcome.stop, RunStop::Limit);
        assert!(matches!(
            machine.run(0),
            Err(CoreError::InvalidRunLimit { max_steps: 0 })
        ));
        assert!(matches!(
            machine.inspect_memory(0, 0),
            Err(CoreError::InspectTooLarge { length: 0 })
        ));
    }

    #[test]
    fn load_lab_listing_runs_indy_rmw_mul_adca_and_bits() {
        const LAB: &str = include_str!("../../../examples/laboratorio-isa.lst");
        let mut machine = Machine::new_e9();
        let result = apply_listing(&mut machine, LAB).expect("listado lab");
        assert_eq!(result.snapshot.pc, 0x2000);
        assert_eq!(machine.cpu().pc, 0x2000);
        let outcome = machine.run(9).expect("run");
        assert_eq!(outcome.steps_taken, 9);
        assert_eq!(machine.cpu().pc, 0x201B);
        assert_eq!(machine.cpu().y, 0x3000);
        assert_eq!(machine.cpu().a, 0x01);
        assert_eq!(machine.cpu().b, 0x0F);
        assert_eq!(machine.bus().read_byte(0x3000), 0x06);
        assert_eq!(machine.bus().read_byte(0x0040), 0x80);
        machine.step().expect("JMP hang");
        assert_eq!(machine.cpu().pc, 0x201B);
    }

    #[test]
    fn load_listing_sets_pc_without_touching_vector() {
        use crate::ipc::listing::SAMPLE_LISTING;

        let mut machine = Machine::new_e9();
        let vector = machine.bus().read_word(0xFFFE);
        let result = apply_listing(&mut machine, SAMPLE_LISTING).expect("listado");
        assert_eq!(result.snapshot.pc, 0x2000);
        assert_eq!(result.summary.entry, 0x2000);
        assert_eq!(machine.cpu().pc, 0x2000);
        assert_eq!(machine.bus().read_word(0xFFFE), vector);
        assert_eq!(machine.bus().read_byte(0x2000), 0x86);
        let outcome = machine.run(65).expect("run");
        assert_eq!(outcome.steps_taken, 65);
        assert_eq!(machine.cpu().pc, 0x201A);
        assert_eq!(machine.bus().read_byte(0x0060), 0);
        assert_eq!(machine.bus().read_byte(0x3000), 1);
        assert_eq!(machine.bus().read_byte(0x3001), 1);
        assert_eq!(machine.bus().read_byte(0x3002), 2);
        assert_eq!(machine.bus().read_byte(0x3003), 3);
        assert_eq!(machine.bus().read_byte(0x3004), 5);
        assert_eq!(machine.bus().read_byte(0x3005), 8);
        assert_eq!(machine.bus().read_byte(0x3006), 13);
        assert_eq!(machine.bus().read_byte(0x3007), 21);
        assert_eq!(machine.bus().read_byte(0x3008), 34);
        assert_eq!(machine.bus().read_byte(0x3009), 55);
        machine.step().expect("JMP hang");
        assert_eq!(machine.cpu().pc, 0x201A);
    }

    #[test]
    fn load_listing_error_does_not_include_payload() {
        let error: IpcError =
            apply_listing(&mut Machine::new_e9(), "SECRET=ROMDUMP\n").expect_err("invalid");
        assert_eq!(error.code, "invalid_listing");
        assert!(!error.message.contains("SECRET"));
    }

    #[test]
    fn write_memory_ram_overlay_and_rom() {
        let mut machine = Machine::new_e9();
        let ram = apply_write_memory(&mut machine, 0x0040, 0x5A, Some(0x0000)).expect("RAM");
        assert_eq!(machine.bus().read_byte(0x0040), 0x5A);
        assert_eq!(ram.memory_view.start, 0x0000);
        assert_eq!(ram.memory_view.bytes.len(), 256);
        assert_eq!(ram.memory_view.bytes[0x40], 0x5A);
        assert_eq!(ram.snapshot.schema_version, 1);

        let overlay =
            apply_write_memory(&mut machine, 0x3000, 0xA5, Some(0x3000)).expect("overlay");
        assert_eq!(machine.bus().read_byte(0x3000), 0xA5);
        assert_eq!(overlay.memory_view.start, 0x3000);
        assert_eq!(overlay.memory_view.bytes[0], 0xA5);

        let before = machine.bus().read_byte(0xD000);
        let error = apply_write_memory(&mut machine, 0xD000, 0x00, Some(0xD000)).expect_err("ROM");
        assert_eq!(error.code, "write_ignored");
        assert!(!error.message.contains("D000"));
        assert_eq!(machine.bus().read_byte(0xD000), before);
    }

    #[test]
    fn load_s19_rejected_address_leaves_machine() {
        let contents = record('1', &[0x10, 0x00, 0xAA]);
        let mut machine = Machine::new_e9();
        let before = machine.clone();
        let error = apply_s19(&mut machine, &contents).expect_err("registro");
        assert_eq!(error.code, "load_rejected");
        assert_eq!(machine.cpu().pc, before.cpu().pc);
        assert_eq!(machine.cycles(), before.cycles());
    }
}
