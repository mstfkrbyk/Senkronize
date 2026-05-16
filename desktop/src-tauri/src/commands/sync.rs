use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub message: String,
    pub synced_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TriggerSyncArgs {
    pub api_url: String,
    pub token: String,
    pub platform: String,
}

#[command]
pub async fn trigger_sync(args: TriggerSyncArgs) -> Result<SyncResult, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/api/v1/listings/sync",
        args.api_url.trim().trim_end_matches('/')
    );

    let response = client
        .post(url)
        .bearer_auth(&args.token)
        .json(&serde_json::json!({ "platform": args.platform }))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    if response.status().is_success() {
        Ok(SyncResult {
            success: true,
            message: format!("{} senkronizasyonu başlatıldı", args.platform),
            synced_at: now,
        })
    } else {
        Ok(SyncResult {
            success: false,
            message: format!("Senkronizasyon başarısız: {}", response.status()),
            synced_at: now,
        })
    }
}
