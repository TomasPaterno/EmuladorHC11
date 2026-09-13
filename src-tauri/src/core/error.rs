//! Errores del núcleo. No dependen de Tauri.

use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CoreError {
    UnimplementedOpcode { pc: u16, opcode: u8 },
    LoadOutOfRange { start: u16, length: usize },
    LoadTooLarge { length: usize },
    LoadRejected { address: u16 },
    InspectTooLarge { length: usize },
    InvalidRunLimit { max_steps: u32 },
}

impl CoreError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::UnimplementedOpcode { .. } => "unimplemented_opcode",
            Self::LoadOutOfRange { .. } => "load_out_of_range",
            Self::LoadTooLarge { .. } => "load_too_large",
            Self::LoadRejected { .. } => "load_rejected",
            Self::InspectTooLarge { .. } => "inspect_too_large",
            Self::InvalidRunLimit { .. } => "invalid_run_limit",
        }
    }
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnimplementedOpcode { pc, opcode } => {
                write!(f, "opcode ${opcode:02X} no implementado en ${pc:04X}")
            }
            Self::LoadOutOfRange { start, length } => write!(
                f,
                "carga de {length} bytes desde ${start:04X} sale del espacio de 64 KiB"
            ),
            Self::LoadTooLarge { length } => {
                write!(f, "carga de {length} bytes excede el máximo permitido")
            }
            Self::LoadRejected { address } => write!(
                f,
                "no se puede cargar en ${address:04X} (registro o espacio no interno)"
            ),
            Self::InspectTooLarge { length } => {
                write!(f, "ventana de {length} bytes excede el máximo de 256")
            }
            Self::InvalidRunLimit { max_steps } => {
                write!(f, "máximo de pasos {max_steps} no está entre 1 y 10000")
            }
        }
    }
}
