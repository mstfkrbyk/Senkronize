use std::sync::{Arc, Mutex};

use chrono::Utc;
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

fn minutes_ago_label(last: Option<chrono::DateTime<chrono::Utc>>) -> String {
    match last {
        Some(t) => {
            let mins = (Utc::now() - t).num_minutes();
            if mins < 1 {
                "az önce".to_string()
            } else {
                format!("{mins} dakika önce")
            }
        }
        None => "henüz yok".to_string(),
    }
}

fn tray_tooltip(last: Option<chrono::DateTime<chrono::Utc>>, mode: TrayIndicatorMode) -> String {
    let ago = minutes_ago_label(last);
    let suffix = match mode {
        TrayIndicatorMode::Idle => "",
        TrayIndicatorMode::Syncing => " · senkron devam ediyor",
        TrayIndicatorMode::Error => " · hata",
    };
    format!("Senkronize - Son sync: {ago}{suffix}")
}

fn icon_for_mode(mode: TrayIndicatorMode) -> tauri::Result<Image<'static>> {
    let bytes: &[u8] = match mode {
        TrayIndicatorMode::Idle => include_bytes!("../icons/tray_idle.png"),
        TrayIndicatorMode::Syncing => include_bytes!("../icons/tray_sync.png"),
        TrayIndicatorMode::Error => include_bytes!("../icons/tray_error.png"),
    };
    Image::from_bytes(bytes).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))
}

fn build_tray_menu<R: Runtime>(handle: &AppHandle<R>, last_line: &str) -> tauri::Result<Menu<R>> {
    let sync_now = MenuItem::with_id(handle, "sync", "Şimdi Sync Et", true, None::<&str>)?;
    let sync_logs = MenuItem::with_id(handle, "sync_logs", "Sync Logları", true, None::<&str>)?;
    let settings = MenuItem::with_id(handle, "settings", "Ayarlar", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(handle)?;
    let last = MenuItem::with_id(handle, "last_sync", last_line, false, None::<&str>)?;
    let quit = MenuItem::with_id(handle, "quit", "Çıkış", true, None::<&str>)?;

    Menu::with_items(handle, &[&sync_now, &sync_logs, &settings, &sep, &last, &quit])
}

pub fn refresh_tray_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let last = app
        .try_state::<AutoSyncState>()
        .and_then(|st| st.last_sync.lock().ok().and_then(|g| *g));
    let mode = app
        .try_state::<TrayIndicatorState>()
        .and_then(|st| st.mode.lock().ok().map(|g| *g))
        .unwrap_or(TrayIndicatorMode::Idle);
    let last_line = format!("Son senkron: {}", minutes_ago_label(last));
    let menu = build_tray_menu(app, &last_line)?;
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu))?;
        let _ = tray.set_tooltip(Some(tray_tooltip(last, mode)));
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

#[tauri::command]
pub async fn set_tray_indicator(app: AppHandle, state: State<'_, TrayIndicatorState>, mode: String) -> Result<(), String> {
    let parsed = match mode.to_ascii_lowercase().as_str() {
        "idle" | "normal" => TrayIndicatorMode::Idle,
        "syncing" | "sync" => TrayIndicatorMode::Syncing,
        "error" | "err" => TrayIndicatorMode::Error,
        _ => return Err("Geçersiz tray modu (idle|syncing|error).".to_string()),
    };

    abort_tray_animation(state.inner());

    {
        let mut g = state.mode.lock().map_err(|_| "Tray mod kilidi".to_string())?;
        *g = parsed;
    }

    let tray = app.tray_by_id(TRAY_ID).ok_or_else(|| "Tray bulunamadı.".to_string())?;

    let last = app
        .try_state::<AutoSyncState>()
        .and_then(|st| st.last_sync.lock().ok().and_then(|g| *g));

    let icon = icon_for_mode(parsed).map_err(|e| e.to_string())?;
    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    tray.set_tooltip(Some(tray_tooltip(last, parsed)))
        .map_err(|e| e.to_string())?;

    if parsed == TrayIndicatorMode::Syncing {
        let app_a = app.clone();
        let st: TrayIndicatorState = state.inner().clone();
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
                    let last = app_a
                        .try_state::<AutoSyncState>()
                        .and_then(|s| s.last_sync.lock().ok().and_then(|g| *g));
                    let _ = tr.set_tooltip(Some(format!(
                        "{} {}",
                        tray_tooltip(last, TrayIndicatorMode::Syncing),
                        frames[tick % frames.len()]
                    )));
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
    }

    refresh_tray_menu(&app).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let handle = app.handle().clone();

    let last = app
        .try_state::<AutoSyncState>()
        .and_then(|st| st.last_sync.lock().ok().and_then(|g| *g));
    let menu = build_tray_menu(&handle, &format!("Son senkron: {}", minutes_ago_label(last)))?;

    let icon = icon_for_mode(TrayIndicatorMode::Idle)?;

    TrayIconBuilder::new()
        .with_id(TRAY_ID)
        .icon(icon)
        .tooltip(tray_tooltip(last, TrayIndicatorMode::Idle))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "sync" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("tray-sync-request", ());
                }
            }
            "sync_logs" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("open-sync-logs", ());
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
