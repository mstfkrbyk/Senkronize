use serde::{Deserialize, Serialize};
use tauri::command;

use crate::services::local_erp;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalErpTestResult {
    pub reachable: bool,
    pub message: String,
}

#[command]
pub async fn test_local_erp_connection(base_url: String) -> Result<LocalErpTestResult, String> {
    let base = base_url.trim().trim_end_matches('/').to_string();
    if base.is_empty() {
        return Ok(LocalErpTestResult {
            reachable: false,
            message: "ERP adresi boş.".to_string(),
        });
    }

    let reachable = local_erp::ping_http_base(&base).await;
    Ok(LocalErpTestResult {
        reachable,
        message: if reachable {
            "Yerel ERP uç noktası yanıt verdi.".to_string()
        } else {
            "Yerel ERP uç noktasına ulaşılamadı.".to_string()
        },
    })
}
