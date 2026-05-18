use serde::Serialize;
use serde_json::Value;
use tauri::AppHandle;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResponse {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub download_url: Option<String>,
    pub release_notes: Option<String>,
}

fn str_field(node: &Value, keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Some(s) = node.get(*k).and_then(|v| v.as_str()) {
            return Some(s.to_string());
        }
    }
    None
}

fn compare_semver_loose(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |s: &str| -> Vec<u32> {
        s.split(|c: char| !c.is_ascii_digit())
            .filter_map(|p| p.parse::<u32>().ok())
            .collect()
    };
    let va = parse(a);
    let vb = parse(b);
    let n = va.len().max(vb.len());
    for i in 0..n {
        let da = *va.get(i).unwrap_or(&0);
        let db = *vb.get(i).unwrap_or(&0);
        match da.cmp(&db) {
            std::cmp::Ordering::Equal => {}
            o => return o,
        }
    }
    a.cmp(b)
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateCheckResponse, String> {
    let current_version = app.package_info().version.to_string();

    let url = "https://api.senkronize.com/api/v1/app/version";
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Sürüm servisi yanıtı: {}", response.status()));
    }

    let body_text = response.text().await.map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_str(&body_text)
        .map_err(|e| format!("Sürüm yanıtı çözümlenemedi: {e}"))?;

    let node = v.get("data").unwrap_or(&v);

    let latest_version = str_field(node, &["latestVersion", "latest_version", "version"])
        .unwrap_or_else(|| current_version.clone());

    let has_update = compare_semver_loose(&current_version, &latest_version) == std::cmp::Ordering::Less;

    Ok(UpdateCheckResponse {
        current_version,
        latest_version,
        has_update,
        download_url: str_field(node, &["downloadUrl", "download_url"]),
        release_notes: str_field(node, &["releaseNotes", "release_notes", "notes"]),
    })
}
