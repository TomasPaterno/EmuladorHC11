//! Núcleo HC11: determinista y sin dependencias de Tauri, UI o reloj de pared.

pub mod cpu;
pub mod error;
pub mod machine;
pub mod memory;
pub mod variant;

pub use error::CoreError;
pub use machine::Machine;
