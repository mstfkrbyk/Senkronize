// Prevents extra console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Giriş noktası yalnızca kütüphaneyi çalıştırır.
//! Sistem tray, pencereyi gizleyerek kapatma ve otomatik senkron `senkronize_desktop_lib` içinde yapılandırılır.
//!
//! Tauri 2 tray API referansı (`tray`, `menu`, `Manager`):
//! ```ignore
//! use tauri::{
//!     menu::{Menu, MenuItem, PredefinedMenuItem},
//!     tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
//!     Manager,
//! };
//! ```

fn main() {
  senkronize_desktop_lib::run();
}
