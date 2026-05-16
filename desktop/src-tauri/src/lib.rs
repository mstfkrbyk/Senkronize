mod commands;
mod services;
mod tray;

use commands::{auth, erp, health, sync};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::save_token,
            auth::load_token,
            auth::clear_token,
            health::check_health,
            sync::trigger_sync,
            erp::test_local_erp_connection,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri uygulaması başlatılamadı");
}
