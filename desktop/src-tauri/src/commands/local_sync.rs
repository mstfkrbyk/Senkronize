use serde::{Deserialize, Serialize};
use tauri::command;

use crate::commands::erp_sync::{sync_erp_orders_impl, sync_erp_products_impl};

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

/// On-premise ERP → bulut ürün/sipariş senkronu (motor `erp_sync` modülünde).
#[command]
pub async fn sync_erp_to_cloud(
    erp_config: ErpConfig,
    cloud_api_url: String,
    cloud_api_key: String,
) -> Result<SyncResult, String> {
    let credentials = serde_json::to_value(&erp_config).map_err(|e| e.to_string())?;

    let products = sync_erp_products_impl(
        erp_config.erp_type.clone(),
        credentials.clone(),
        cloud_api_url.clone(),
        cloud_api_key.clone(),
    )
    .await?;

    let orders = sync_erp_orders_impl(
        erp_config.erp_type,
        credentials,
        cloud_api_url,
        cloud_api_key,
    )
    .await?;

    let mut errs: Vec<String> = Vec::new();
    errs.extend(products.errors);
    errs.extend(orders.errors);

    let synced_count = products
        .products_synced
        .saturating_add(orders.orders_pushed);
    let error_count = errs.len() as u32;
    let success = errs.is_empty();

    let message = if success {
        format!(
            "Ürün: {}, sipariş: {} ({} ms)",
            products.products_synced,
            orders.orders_pushed,
            products.duration_ms.max(orders.duration_ms)
        )
    } else {
        let joined = errs.join(" | ");
        joined.chars().take(900).collect::<String>()
    };

    Ok(SyncResult {
        success,
        synced_count,
        error_count,
        message,
    })
}
