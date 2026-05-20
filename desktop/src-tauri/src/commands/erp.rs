use std::time::Instant;

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
    pub erp_version: Option<String>,
    pub duration_ms: u64,
}

fn erp_auth_url(erp_type: &str, base: &str) -> Result<String, String> {
    Ok(match erp_type {
        "LOGO" => format!("{base}/logo/api/v1/token"),
        "BIZIMHESAP" => format!("{base}/bizimhesap/api/v1/auth"),
        "NEBIM" => format!("{base}/nebim/api/v1/auth/login"),
        "PARASUT" => format!("{base}/parasut/oauth/token"),
        "MIKRO" => format!("{base}/mikro/api/auth/login"),
        "NETSIS" => format!("{base}/netsis/api/v1/auth/token"),
        _ => return Err("Desteklenmeyen ERP tipi".to_string()),
    })
}

fn erp_products_probe_url(erp_type: &str, base: &str) -> String {
    match erp_type {
        "LOGO" => format!("{base}/logo/api/v1/products?page=1&pageSize=1"),
        "BIZIMHESAP" => format!("{base}/bizimhesap/api/v1/products?limit=1"),
        "NEBIM" => format!("{base}/nebim/api/v1/products?page=1&pageSize=1"),
        "PARASUT" => format!("{base}/parasut/v4/products?limit=1"),
        "MIKRO" => format!("{base}/mikro/api/products?page=1&limit=1"),
        "NETSIS" => format!("{base}/netsis/api/v1/products?page=1&pageSize=1"),
        _ => format!("{base}/api/v1/products?limit=1"),
    }
}

fn count_products_in_value(v: &serde_json::Value) -> u32 {
    if let Some(arr) = v.as_array() {
        return arr.len().min(u32::MAX as usize) as u32;
    }
    if let Some(n) = v
        .get("total")
        .or_else(|| v.get("count"))
        .or_else(|| v.get("productCount"))
        .and_then(|x| x.as_u64())
    {
        return n.min(u32::MAX as u64) as u32;
    }
    if let Some(arr) = v.get("data").and_then(|d| d.as_array()) {
        return arr.len().min(u32::MAX as usize) as u32;
    }
    if let Some(arr) = v.get("products").and_then(|d| d.as_array()) {
        return arr.len().min(u32::MAX as usize) as u32;
    }
    0
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
            "Yerel ERP uç noktasına ulaşılamadı.".to_string(),
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
    let start = Instant::now();
    let base = base_url.trim().trim_end_matches('/').to_string();
    if base.is_empty() {
        return Ok(ErpTestResult {
            success: false,
            message: "Sunucu URL boş olamaz.".to_string(),
            product_count: None,
            erp_version: None,
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    let erp = erp_type.trim();
    let test_url = erp_auth_url(erp, &base)?;

    let body = match erp {
        "BIZIMHESAP" | "PARASUT" => serde_json::json!({
            "apiKey": password,
            "apiToken": password,
            "token": password,
        }),
        "LOGO" => serde_json::json!({
            "username": username,
            "password": password,
            "firmNo": extra.clone().unwrap_or_default(),
            "companyCode": extra.unwrap_or_default(),
        }),
        "NEBIM" => serde_json::json!({
            "server": base_url,
            "username": username,
            "password": password,
            "database": extra.unwrap_or_default(),
        }),
        _ => serde_json::json!({
            "username": username,
            "password": password,
            "firmNo": extra.unwrap_or_default(),
        }),
    };

    let auth_resp = client.post(&test_url).json(&body).send().await;

    let (success, message, erp_version) = match auth_resp {
        Ok(resp) if resp.status().is_success() => {
            let text = resp.text().await.unwrap_or_default();
            let version = serde_json::from_str::<serde_json::Value>(&text)
                .ok()
                .and_then(|v| {
                    v.get("version")
                        .or_else(|| v.get("erpVersion"))
                        .and_then(|x| x.as_str())
                        .map(|s| s.to_string())
                });
            (
                true,
                "✓ Bağlantı başarılı".to_string(),
                version.or_else(|| Some(format!("{erp} bağlantısı doğrulandı"))),
            )
        }
        Ok(resp) => (
            false,
            format!("✗ HTTP {}: ERP bağlantısı reddedildi", resp.status()),
            None,
        ),
        Err(e) => (false, format!("✗ Bağlantı hatası: {e}"), None),
    };

    let mut product_count: Option<u32> = None;
    if success {
        let probe_url = erp_products_probe_url(erp, &base);
        let probe = client
            .get(&probe_url)
            .basic_auth(username.trim(), Some(password.as_str()))
            .send()
            .await;
        if let Ok(r) = probe {
            if r.status().is_success() {
                if let Ok(text) = r.text().await {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                        let n = count_products_in_value(&v);
                        product_count = Some(if n == 0 { 1 } else { n });
                    }
                }
            }
        }
    }

    Ok(ErpTestResult {
        success,
        message,
        product_count,
        erp_version,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}
