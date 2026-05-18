use std::sync::{Arc, Mutex};

use tauri::{
    async_runtime::spawn,
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime, State,
};
use tokio::task::JoinHandle;
use tokio::time::{sleep, Duration};

use crate::commands::auto_sync::AutoSyncState;

const TRAY_ID: &str = "senkronize_tray";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TrayIndicatorMode {
    Idle,
    Syncing,
    Error,
}

#[derive(Clone)]
pub struct TrayIndicatorState {
    mode: Arc<Mutex<TrayIndicatorMode>>,
    animation: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl Default for TrayIndicatorState {
    fn default() -> Self {
        Self {
            mode: Arc::new(Mutex::new(TrayIndicatorMode::Idle)),
            animation: Arc::new(Mutex::new(None)),
        }
    }
}

fn last_sync_label(last: Option<chrono::DateTime<chrono::Utc>>) -> String {
    match last {
        Some(t) => {
            let local = t.format("%d.%m.%Y %H:%M UTC").to_string();
            format!("Son senkron: {local}")
        }
        None => "Son senkron: —".to_string(),
    }
}

fn indicator_suffix(mode: TrayIndicatorMode) -> &'static str {
    match mode {
        TrayIndicatorMode::Idle => "",
        TrayIndicatorMode::Syncing => " · çalışıyor",
        TrayIndicatorMode::Error => " · hata",
    }
}

fn build_tray_menu<R: Runtime>(handle: &AppHandle<R>, last_line: &str, version: &str) -> tauri::Result<Menu<R>> {
    let title = MenuItem::with_id(
        handle,
        "tray_title",
        &format!("Senkronize v{version}"),
        false,
        None::<&str>,
    )?;
    let open = MenuItem::with_id(handle, "open_panel", "Paneli Aç", true, None::<&str>)?;
    let dashboard = MenuItem::with_id(handle, "dashboard", "Dashboard'u Aç", true, None::<&str>)?;
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
            &dashboard,
            &sep1,
            &last,
            &sync,
            &sep2,
            &settings,
            &quit,
        ],
    )
}

pub fn refresh_tray_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let last = app
        .try_state::<AutoSyncState>()
        .and_then(|st| st.last_sync.lock().ok().and_then(|g| *g));
    let mode = app
        .try_state::<TrayIndicatorState>()
        .and_then(|st| st.mode.lock().ok().map(|g| *g))
        .unwrap_or(TrayIndicatorMode::Idle);
    let version = app.package_info().version.to_string();
    let mut last_line = last_sync_label(last);
    last_line.push_str(indicator_suffix(mode));
    let menu = build_tray_menu(app, &last_line, &version)?;
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

fn abort_tray_animation(state: &TrayIndicatorState) {
    if let Ok(mut slot) = state.animation.lock() {
        if let Some(h) = slot.take() {
            h.abort();
        }
    }
}

fn default_tray_icon() -> tauri::Result<Image<'static>> {
    Image::from_bytes(include_bytes!("../icons/icon.png"))
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))
}

#[tauri::command]
pub async fn set_tray_indicator(app: AppHandle, state: State<'_, TrayIndicatorState>, mode: String) -> Result<(), String> {
    let parsed = match mode.to_ascii_lowercase().as_str() {
        "idle" | "normal" => TrayIndicatorMode::Idle,
        "syncing" | "sync" => TrayIndicatorMode::Syncing,
        "error" | "err" => TrayIndicatorMode::Error,
        _ => return Err("Geçersiz tray modu (idle|syncing|error).".to_string()),
    };

    abort_tray_animation(&state);

    {
        let mut g = state.mode.lock().map_err(|_| "Tray mod kilidi".to_string())?;
        *g = parsed;
    }

    let tray = app.tray_by_id(TRAY_ID).ok_or_else(|| "Tray bulunamadı.".to_string())?;

    match parsed {
        TrayIndicatorMode::Idle => {
            tray.set_tooltip(Some("Senkronize")).map_err(|e| e.to_string())?;
            let icon = default_tray_icon().map_err(|e| e.to_string())?;
            tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
        }
        TrayIndicatorMode::Syncing => {
            let app_a = app.clone();
            let st: TrayIndicatorState = (*state).clone();
            let h = spawn(async move {
                let frames = [
                    "Senkronize · senkron",
                    "Senkronize • senkron",
                    "Senkronize ·· senkron",
                    "Senkronize •• senkron",
                ];
                let mut tick: usize = 0;
                loop {
                    if let Some(tr) = app_a.tray_by_id(TRAY_ID) {
                        let _ = tr.set_tooltip(Some(frames[tick % frames.len()]));
                    }
                    tick = tick.wrapping_add(1);
                    sleep(Duration::from_millis(420)).await;
                    let mode_now = st
                        .mode
                        .lock()
                        .ok()
                        .map(|g| *g)
                        .unwrap_or(TrayIndicatorMode::Idle);
                    if mode_now != TrayIndicatorMode::Syncing {
                        break;
                    }
                }
            });
            if let Ok(mut slot) = state.animation.lock() {
                *slot = Some(h);
            }
            let icon = default_tray_icon().map_err(|e| e.to_string())?;
            tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
        }
        TrayIndicatorMode::Error => {
            tray.set_tooltip(Some("Senkronize — senkronizasyon hatası"))
                .map_err(|e| e.to_string())?;
            let icon = default_tray_icon().map_err(|e| e.to_string())?;
            tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
        }
    }

    refresh_tray_menu(&app).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let handle = app.handle().clone();

    let last = app
        .try_state::<AutoSyncState>()
        .and_then(|st| st.last_sync.lock().ok().and_then(|g| *g));
    let version = handle.package_info().version.to_string();
    let menu = build_tray_menu(&handle, &last_sync_label(last), &version)?;

    let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))?;

    TrayIconBuilder::new()
        .with_id(TRAY_ID)
        .icon(icon.clone())
        .tooltip("Senkronize")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "open_panel" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "dashboard" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("open-dashboard", ());
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
