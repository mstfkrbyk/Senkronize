use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub message: String,
    pub synced_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
}

#[command]
pub async fn trigger_sync(
    api_url: String,
    token: String,
    platform: String,
) -> Result<SyncResult, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/api/v1/listings/sync",
        api_url.trim().trim_end_matches('/')
    );

    let response = client
        .post(url)
        .bearer_auth(&token)
        .json(&serde_json::json!({ "platform": platform }))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    let status = response.status();
    let body_text = response.text().await.map_err(|e| e.to_string())?;
    let parsed: Value = serde_json::from_str(&body_text).unwrap_or(Value::Null);

    if status.is_success() {
        let message = parsed
            .get("message")
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| format!("{} senkronizasyonu başlatıldı", platform));
        Ok(SyncResult {
            success: true,
            message,
            synced_at: now,
            level: Some("SUCCESS".to_string()),
        })
    } else {
        let message = parsed
            .get("message")
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| format!("Senkronizasyon başarısız: {}", status));
        Ok(SyncResult {
            success: false,
            message,
            synced_at: now,
            level: Some("ERROR".to_string()),
        })
    }
}
