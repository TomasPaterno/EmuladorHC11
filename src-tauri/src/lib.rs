mod core;
mod ipc;

use ipc::AppState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(core::Machine::new_e9())))
        .invoke_handler(tauri::generate_handler![
            ipc::commands::reset,
            ipc::commands::step,
            ipc::commands::run,
            ipc::commands::inspect_memory,
            ipc::commands::write_memory,
            ipc::commands::load_bytes,
            ipc::commands::load_s19,
            ipc::commands::load_listing,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
