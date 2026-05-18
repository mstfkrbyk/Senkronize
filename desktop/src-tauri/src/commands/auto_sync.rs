use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::task::JoinHandle;
use tokio::time::{interval, Duration};

use crate::tray;

pub struct AutoSyncState {
    pub interval_minutes: Arc<Mutex<u64>>,
    pub last_sync: Arc<Mutex<Option<DateTime<Utc>>>>,
    pub is_running: Arc<Mutex<bool>>,
    stop_flag: Arc<AtomicBool>,
    join_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl Default for AutoSyncState {
    fn default() -> Self {
        Self {
            interval_minutes: Arc::new(Mutex::new(15)),
            last_sync: Arc::new(Mutex::new(None)),
            is_running: Arc::new(Mutex::new(false)),
            stop_flag: Arc::new(AtomicBool::new(false)),
            join_handle: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusResponse {
    pub interval_minutes: u64,
    pub last_sync: Option<String>,
    pub is_running: bool,
}

#[tauri::command]
pub async fn start_auto_sync(
    app: AppHandle,
    state: State<'_, AutoSyncState>,
    interval_minutes: u64,
) -> Result<(), String> {
    if interval_minutes == 0 {
        return Err("Aralık 0 olamaz.".to_string());
    }

    let was_running = *state
        .is_running
        .lock()
        .map_err(|_| "Durum kilidi alınamadı".to_string())?;

    if was_running {
        state.stop_flag.store(true, Ordering::SeqCst);
        if let Some(h) = state
            .join_handle
            .lock()
            .map_err(|_| "Görev kilidi alınamadı".to_string())?
            .take()
        {
            h.abort();
        }
        {
            let mut running = state
                .is_running
                .lock()
                .map_err(|_| "Durum kilidi alınamadı".to_string())?;
            *running = false;
        }
        state.stop_flag.store(false, Ordering::SeqCst);
    }

    {
        let mut running = state
            .is_running
            .lock()
            .map_err(|_| "Durum kilidi alınamadı".to_string())?;
        *running = true;
    }

    {
        let mut guard = state
            .interval_minutes
            .lock()
            .map_err(|_| "Aralık kilidi alınamadı".to_string())?;
        *guard = interval_minutes;
    }

    state.stop_flag.store(false, Ordering::SeqCst);

    if let Some(h) = state
        .join_handle
        .lock()
        .map_err(|_| "Görev kilidi alınamadı".to_string())?
        .take()
    {
        h.abort();
    }

    let app_c = app.clone();
    let stop = state.stop_flag.clone();
    let handle = tokio::spawn(async move {
        let mut intv = interval(Duration::from_secs(interval_minutes.saturating_mul(60)));
        intv.tick().await;
        loop {
            intv.tick().await;
            if stop.load(Ordering::SeqCst) {
                break;
            }
            let _ = app_c.emit("auto-sync-tick", ());
        }
    });

    {
        let mut slot = state
            .join_handle
            .lock()
            .map_err(|_| "Görev kilidi alınamadı".to_string())?;
        *slot = Some(handle);
    }

    Ok(())
}

#[tauri::command]
pub async fn stop_auto_sync(state: State<'_, AutoSyncState>) -> Result<(), String> {
    state.stop_flag.store(true, Ordering::SeqCst);

    if let Some(h) = state
        .join_handle
        .lock()
        .map_err(|_| "Görev kilidi alınamadı".to_string())?
        .take()
    {
        h.abort();
    }

    {
        let mut running = state
            .is_running
            .lock()
            .map_err(|_| "Durum kilidi alınamadı".to_string())?;
        *running = false;
    }

    state.stop_flag.store(false, Ordering::SeqCst);

    Ok(())
}

#[tauri::command]
pub async fn get_sync_status(state: State<'_, AutoSyncState>) -> Result<SyncStatusResponse, String> {
    let interval_minutes = *state
        .interval_minutes
        .lock()
        .map_err(|_| "Aralık kilidi alınamadı".to_string())?;
    let last_sync = state
        .last_sync
        .lock()
        .map_err(|_| "Son senkron kilidi alınamadı".to_string())?
        .map(|t| t.to_rfc3339());
    let is_running = *state
        .is_running
        .lock()
        .map_err(|_| "Durum kilidi alınamadı".to_string())?;

    Ok(SyncStatusResponse {
        interval_minutes,
        last_sync,
        is_running,
    })
}

/// Tray ve ayarlar ekranı için son senkron zamanını günceller.
#[tauri::command]
pub async fn record_last_sync(
    app: AppHandle,
    state: State<'_, AutoSyncState>,
    at_rfc3339: Option<String>,
) -> Result<(), String> {
    let parsed = if let Some(s) = at_rfc3339 {
        DateTime::parse_from_rfc3339(&s)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|e| format!("Geçersiz tarih: {e}"))?
    } else {
        Utc::now()
    };

    {
        let mut guard = state
            .last_sync
            .lock()
            .map_err(|_| "Son senkron kilidi alınamadı".to_string())?;
        *guard = Some(parsed);
    }

    tray::refresh_tray_menu(&app).map_err(|e| e.to_string())?;
    let _ = app.emit("sync-status-changed", ());
    Ok(())
}
