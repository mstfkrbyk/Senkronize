mod commands;
mod services;
mod tray;

use commands::{auth, auto_sync, erp, erp_sync, health, local_sync, sync, updater};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .manage(auto_sync::AutoSyncState::default())
        .manage(tray::TrayIndicatorState::default())
        .invoke_handler(tauri::generate_handler![
            auth::save_token,
            auth::load_token,
            auth::clear_token,
            health::check_health,
            sync::trigger_sync,
            erp::test_local_erp_connection,
            erp::test_erp_connection,
            local_sync::sync_erp_to_cloud,
            erp_sync::sync_erp_products,
            erp_sync::sync_erp_orders,
            erp_sync::sync_delta,
            erp_sync::get_erp_sync_status,
            auto_sync::start_auto_sync,
            auto_sync::stop_auto_sync,
            auto_sync::get_sync_status,
            auto_sync::record_last_sync,
            auto_sync::set_tray_erp_name,
            updater::check_for_updates,
            tray::set_tray_indicator,
        ])
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("Tauri uygulaması başlatılamadı");
}
