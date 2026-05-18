use std::time::Instant;

use chrono::Utc;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErpSyncEngineResult {
    pub products_synced: u32,
    pub orders_pushed: u32,
    pub errors: Vec<String>,
    pub duration_ms: u64,
    pub synced_at: String,
}

fn cred_str(credentials: &Value, keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Some(s) = credentials.get(*k).and_then(|v| v.as_str()) {
            let t = s.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }
    None
}

fn erp_base_url(credentials: &Value) -> Option<String> {
    cred_str(credentials, &["baseUrl", "base_url", "erpBaseUrl", "erp_base_url"]).map(|b| b.trim_end_matches('/').to_string())
}

fn erp_products_source_url(erp_type: &str, base: &str) -> String {
    match erp_type {
        "LOGO" => format!("{base}/logo/api/v1/products?page=1&pageSize=200"),
        "MIKRO" => format!("{base}/mikro/api/products?page=1&limit=200"),
        "NETSIS" => format!("{base}/netsis/api/v1/products?page=1&pageSize=200"),
        _ => format!("{base}/api/v1/products?page=1&limit=200"),
    }
}

fn cloud_products_push_url(cloud_api_url: &str) -> String {
    let base = cloud_api_url.trim().trim_end_matches('/');
    format!("{base}/api/v1/erp/sync/products")
}

fn cloud_orders_pull_url(cloud_api_url: &str) -> String {
    let base = cloud_api_url.trim().trim_end_matches('/');
    format!("{base}/api/v1/erp/sync/orders/pending")
}

fn cloud_orders_ack_url(cloud_api_url: &str) -> String {
    let base = cloud_api_url.trim().trim_end_matches('/');
    format!("{base}/api/v1/erp/sync/orders/ack")
}

fn erp_orders_push_url(erp_type: &str, base: &str) -> String {
    match erp_type {
        "LOGO" => format!("{base}/logo/api/v1/orders/import"),
        "MIKRO" => format!("{base}/mikro/api/orders/import"),
        "NETSIS" => format!("{base}/netsis/api/v1/orders/import"),
        _ => format!("{base}/api/v1/orders/import"),
    }
}

fn erp_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())
}

fn bearer_headers(api_key: &str) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    let value = format!("Bearer {}", api_key.trim());
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&value).map_err(|e| e.to_string())?,
    );
    Ok(headers)
}

fn u32_from_cloud(node: &Value, keys: &[&str]) -> u32 {
    for k in keys {
        if let Some(n) = node.get(*k).and_then(|v| v.as_u64()) {
            return n.min(u32::MAX as u64) as u32;
        }
        if let Some(n) = node.get(*k).and_then(|v| v.as_i64()) {
            if n >= 0 {
                return (n as u64).min(u32::MAX as u64) as u32;
            }
        }
    }
    0
}

/// ERP ürünlerini okuyup buluta iletir (bulut uçları hazır olduğunda uçtan uca çalışır).
pub async fn sync_erp_products_impl(
    erp_type: String,
    credentials: Value,
    cloud_api_url: String,
    api_key: String,
) -> Result<ErpSyncEngineResult, String> {
    let start = Instant::now();
    let mut errors: Vec<String> = Vec::new();
    let synced_at = Utc::now().to_rfc3339();

    let erp_base = match erp_base_url(&credentials) {
        Some(b) => b,
        None => {
            return Err("Kimlik bilgisinde sunucu URL (baseUrl) bulunamadı.".to_string());
        }
    };

    let client = erp_http_client()?;
    let username = cred_str(&credentials, &["username", "user", "erpUsername"]).unwrap_or_default();
    let password = cred_str(&credentials, &["password", "pass", "erpPassword"]).unwrap_or_default();

    let products_url = erp_products_source_url(erp_type.trim(), &erp_base);
    let erp_resp = client
        .get(&products_url)
        .basic_auth(username, Some(password))
        .send()
        .await;

    let products_value = match erp_resp {
        Ok(r) => {
            let status = r.status();
            let text = r.text().await.unwrap_or_default();
            if !status.is_success() {
                errors.push(format!("ERP ürün listesi HTTP {status}: {text}",));
                json!([])
            } else {
                match serde_json::from_str::<Value>(&text) {
                    Ok(v) => {
                        if v.as_array().is_some() {
                            v
                        } else if let Some(arr) = v.get("data").and_then(|d| d.as_array()) {
                            json!(arr.clone())
                        } else if let Some(arr) = v.get("products").and_then(|d| d.as_array()) {
                            json!(arr.clone())
                        } else {
                            errors.push("ERP ürün yanıtı beklenen dizi formatında değil; boş gönderildi.".to_string());
                            json!([])
                        }
                    }
                    Err(e) => {
                        errors.push(format!("ERP ürün JSON çözümlenemedi: {e}"));
                        json!([])
                    }
                }
            }
        }
        Err(e) => {
            errors.push(format!("ERP ürün isteği başarısız: {e}"));
            json!([])
        }
    };

    let cloud_url = cloud_products_push_url(&cloud_api_url);
    let cloud_headers = bearer_headers(&api_key)?;
    let body = json!({
        "erpType": erp_type,
        "credentials": credentials,
        "products": products_value,
        "syncedAt": synced_at,
    });

    let cloud_resp = client
        .post(&cloud_url)
        .headers(cloud_headers)
        .json(&body)
        .send()
        .await;

    let products_synced = match cloud_resp {
        Ok(r) => {
            let status = r.status();
            let text = r.text().await.unwrap_or_default();
            if !status.is_success() {
                errors.push(format!("Bulut ürün senkronu HTTP {status}: {text}",));
                0
            } else {
                let parsed: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
                let node = parsed.get("data").unwrap_or(&parsed);
                u32_from_cloud(node, &["productsSynced", "products_synced", "synced", "count"])
            }
        }
        Err(e) => {
            errors.push(format!("Bulut ürün senkronu isteği başarısız: {e}"));
            0
        }
    };

    Ok(ErpSyncEngineResult {
        products_synced,
        orders_pushed: 0,
        errors,
        duration_ms: start.elapsed().as_millis() as u64,
        synced_at,
    })
}

/// Buluttan bekleyen siparişleri alır ve ERP'ye aktarır (uçlar hazır olduğunda).
pub async fn sync_erp_orders_impl(
    erp_type: String,
    credentials: Value,
    cloud_api_url: String,
    api_key: String,
) -> Result<ErpSyncEngineResult, String> {
    let start = Instant::now();
    let mut errors: Vec<String> = Vec::new();
    let synced_at = Utc::now().to_rfc3339();

    let erp_base = match erp_base_url(&credentials) {
        Some(b) => b,
        None => {
            return Err("Kimlik bilgisinde sunucu URL (baseUrl) bulunamadı.".to_string());
        }
    };

    let client = erp_http_client()?;
    let cloud_headers = bearer_headers(&api_key)?;
    let pull_url = cloud_orders_pull_url(&cloud_api_url);

    let pending = match client.get(&pull_url).headers(cloud_headers.clone()).send().await {
        Ok(r) => {
            let status = r.status();
            let text = r.text().await.unwrap_or_default();
            if !status.is_success() {
                errors.push(format!("Bulut bekleyen siparişler HTTP {status}: {text}",));
                json!([])
            } else {
                match serde_json::from_str::<Value>(&text) {
                    Ok(v) => {
                        if let Some(arr) = v.as_array() {
                            json!(arr.clone())
                        } else if let Some(arr) = v.get("data").and_then(|d| d.as_array()) {
                            json!(arr.clone())
                        } else if let Some(arr) = v.get("orders").and_then(|d| d.as_array()) {
                            json!(arr.clone())
                        } else {
                            errors.push("Bulut sipariş yanıtı beklenen dizi formatında değil.".to_string());
                            json!([])
                        }
                    }
                    Err(e) => {
                        errors.push(format!("Bulut sipariş JSON çözümlenemedi: {e}"));
                        json!([])
                    }
                }
            }
        }
        Err(e) => {
            errors.push(format!("Bulut bekleyen sipariş isteği başarısız: {e}"));
            json!([])
        }
    };

    let username = cred_str(&credentials, &["username", "user", "erpUsername"]).unwrap_or_default();
    let password = cred_str(&credentials, &["password", "pass", "erpPassword"]).unwrap_or_default();

    let push_url = erp_orders_push_url(erp_type.trim(), &erp_base);
    let erp_push = client
        .post(&push_url)
        .basic_auth(username, Some(password))
        .json(&json!({ "orders": pending }))
        .send()
        .await;

    let orders_pushed = match erp_push {
        Ok(r) => {
            let status = r.status();
            let text = r.text().await.unwrap_or_default();
            if !status.is_success() {
                errors.push(format!("ERP sipariş aktarımı HTTP {status}: {text}",));
                0
            } else {
                let parsed: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
                let node = parsed.get("data").unwrap_or(&parsed);
                u32_from_cloud(node, &["ordersPushed", "orders_pushed", "imported", "count"])
            }
        }
        Err(e) => {
            errors.push(format!("ERP sipariş aktarımı başarısız: {e}"));
            0
        }
    };

    if orders_pushed > 0 {
        let ack_body = json!({ "erpType": erp_type, "syncedAt": synced_at, "count": orders_pushed });
        if let Err(e) = client
            .post(cloud_orders_ack_url(&cloud_api_url))
            .headers(cloud_headers)
            .json(&ack_body)
            .send()
            .await
        {
            errors.push(format!("Bulut sipariş onayı (ack) başarısız: {e}"));
        }
    }

    Ok(ErpSyncEngineResult {
        products_synced: 0,
        orders_pushed,
        errors,
        duration_ms: start.elapsed().as_millis() as u64,
        synced_at,
    })
}

#[command]
pub async fn sync_erp_products(
    erp_type: String,
    credentials: Value,
    cloud_api_url: String,
    api_key: String,
) -> Result<ErpSyncEngineResult, String> {
    sync_erp_products_impl(erp_type, credentials, cloud_api_url, api_key).await
}

#[command]
pub async fn sync_erp_orders(
    erp_type: String,
    credentials: Value,
    cloud_api_url: String,
    api_key: String,
) -> Result<ErpSyncEngineResult, String> {
    sync_erp_orders_impl(erp_type, credentials, cloud_api_url, api_key).await
}
