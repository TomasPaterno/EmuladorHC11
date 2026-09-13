fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "reset",
            "step",
            "run",
            "inspect_memory",
            "write_memory",
            "load_bytes",
            "load_s19",
            "load_listing",
        ]),
    ))
    .expect("tauri build failed");
}
