pub mod addressing;
pub mod ccr;
pub mod decode;
pub mod execute;
pub mod registers;
pub mod trace;

#[cfg(test)]
mod isa_lab;
#[cfg(test)]
mod isa_spec;
#[cfg(test)]
mod isa_wave1;

pub use registers::Registers;
