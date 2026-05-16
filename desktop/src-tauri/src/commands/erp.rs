use serde::{Deserialize, Serialize};
use tauri::command;

use crate::services::local_erp;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalErpTestResult {
    pub reachable: bool,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestLocalErpArgs {
    pub base_url: String,
}

#[command]
pub async fn test_local_erp_connection(
    args: TestLocalErpArgs,
) -> Result<LocalErpTestResult, String> {
    let base = args.base_url.trim().trim_end_matches('/').to_string();
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
