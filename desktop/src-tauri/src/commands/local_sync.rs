use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErpConfig {
    pub erp_type: String,
    pub base_url: String,
    pub username: String,
    pub password: String,
    pub extra: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub synced_count: u32,
    pub error_count: u32,
    pub message: String,
}

/// On-premise ERP → bulut toplu içe aktarma (şimdilik iskelet; gerçek uç noktalar sonraki adımda).
#[command]
pub async fn sync_erp_to_cloud(
    _erp_config: ErpConfig,
    _cloud_api_url: String,
    _cloud_api_key: String,
) -> Result<SyncResult, String> {
    Ok(SyncResult {
        success: true,
        synced_count: 0,
        error_count: 0,
        message: "Senkronizasyon tamamlandı".to_string(),
    })
}
