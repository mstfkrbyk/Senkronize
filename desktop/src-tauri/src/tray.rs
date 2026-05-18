use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

use crate::commands::auto_sync::AutoSyncState;

const TRAY_ID: &str = "senkronize_tray";

fn last_sync_label(last: Option<chrono::DateTime<chrono::Utc>>) -> String {
    match last {
        Some(t) => {
            let local = t.format("%d.%m.%Y %H:%M UTC").to_string();
            format!("Son Sync: {local}")
        }
        None => "Son Sync: —".to_string(),
    }
}

fn build_tray_menu<R: Runtime>(handle: &AppHandle<R>, last_line: &str) -> tauri::Result<Menu<R>> {
    let title = MenuItem::with_id(handle, "tray_title", "Senkronize", false, None::<&str>)?;
    let open = MenuItem::with_id(handle, "open_panel", "Paneli Aç", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(handle)?;
    let last = MenuItem::with_id(handle, "last_sync", last_line, false, None::<&str>)?;
    let sync = MenuItem::with_id(handle, "sync", "Şimdi Senkronize Et", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(handle)?;
    let settings = MenuItem::with_id(handle, "settings", "Ayarlar", true, None::<&str>)?;
    let quit = MenuItem::with_id(handle, "quit", "Çıkış", true, None::<&str>)?;

    Menu::with_items(
        handle,
        &[
            &title,
            &open,
            &sep1,
            &last,
            &sync,
            &sep2,
            &settings,
            &quit,
        ],
    )?
}

pub fn refresh_tray_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let last = app
        .try_state::<AutoSyncState>()
        .and_then(|st| st.last_sync.lock().ok().and_then(|g| *g));
    let menu = build_tray_menu(app, &last_sync_label(last))?;
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let handle = app.handle().clone();

    let last = app
        .try_state::<AutoSyncState>()
        .and_then(|st| st.last_sync.lock().ok().and_then(|g| *g));
    let menu = build_tray_menu(&handle, &last_sync_label(last))?;

    let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))?;

    TrayIconBuilder::new()
        .with_id(TRAY_ID)
        .icon(icon.clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "open_panel" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "sync" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("tray-sync-request", ());
                }
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("open-settings", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
