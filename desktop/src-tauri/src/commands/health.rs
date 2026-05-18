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
    pub orders_last_24h: Option<u64>,
    pub listings_synced_last_24h: Option<u64>,
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

    let since = chrono::Utc::now() - chrono::Duration::hours(24);
    let since_iso = since.to_rfc3339();

    let (orders_last_24h, listings_synced_last_24h) = if cloud_ok {
        (
            api_client::count_orders_since(&client, &api_url, &token, &since_iso).await,
            api_client::count_listings_last_sync_since(&client, &api_url, &token, &since_iso)
                .await,
        )
    } else {
        (None, None)
    };

    Ok(HealthStatus {
        cloud_connected: cloud_ok,
        local_erp_connected,
        last_sync_at: None,
        version: env!("CARGO_PKG_VERSION").to_string(),
        orders_last_24h,
        listings_synced_last_24h,
    })
}
