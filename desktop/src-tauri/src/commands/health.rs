use serde::Serialize;
use tauri::command;

use crate::services::{api_client, local_erp};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub cloud_connected: bool,
    pub local_erp_connected: bool,
    pub last_sync_at: Option<String>,
    pub version: String,
}

#[command]
pub async fn check_health(
    api_url: String,
    token: String,
    local_erp_base_url: Option<String>,
) -> Result<HealthStatus, String> {
    let client = api_client::http_client();
    let cloud_ok = api_client::ping_cloud_health(&client, &api_url, &token).await;

    let local_erp_connected = match &local_erp_base_url {
        Some(url) if !url.trim().is_empty() => local_erp::ping_http_base(url).await,
        _ => false,
    };

    Ok(HealthStatus {
        cloud_connected: cloud_ok,
        local_erp_connected,
        last_sync_at: None,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}
