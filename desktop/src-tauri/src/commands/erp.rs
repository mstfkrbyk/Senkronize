use serde::{Deserialize, Serialize};
use tauri::command;

use crate::services::local_erp;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalErpTestResult {
    pub reachable: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErpTestResult {
    pub success: bool,
    pub message: String,
    pub product_count: Option<u32>,
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

#[command]
pub async fn test_erp_connection(
    erp_type: String,
    base_url: String,
    username: String,
    password: String,
    extra: Option<String>,
) -> Result<ErpTestResult, String> {
    let base = base_url.trim().trim_end_matches('/').to_string();
    if base.is_empty() {
        return Ok(ErpTestResult {
            success: false,
            message: "Sunucu URL boş olamaz.".to_string(),
            product_count: None,
        });
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    let test_url = match erp_type.as_str() {
        "LOGO" => format!("{}/logo/api/v1/token", base),
        "MIKRO" => format!("{}/mikro/api/auth/login", base),
        "NETSIS" => format!("{}/netsis/api/v1/auth/token", base),
        _ => return Err("Desteklenmeyen ERP tipi".to_string()),
    };

    let body = serde_json::json!({
        "username": username,
        "password": password,
        "firmNo": extra.unwrap_or_default(),
    });

    match client.post(&test_url).json(&body).send().await {
        Ok(resp) if resp.status().is_success() => Ok(ErpTestResult {
            success: true,
            message: "ERP bağlantısı başarılı".to_string(),
            product_count: None,
        }),
        Ok(resp) => Ok(ErpTestResult {
            success: false,
            message: format!("HTTP {}: ERP bağlantısı reddedildi", resp.status()),
            product_count: None,
        }),
        Err(e) => Ok(ErpTestResult {
            success: false,
            message: format!("Bağlantı hatası: {}", e),
            product_count: None,
        }),
    }
}
