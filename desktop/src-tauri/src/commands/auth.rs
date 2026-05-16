use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::command;

const SERVICE_NAME: &str = "senkronize-desktop";
const TOKEN_KEY: &str = "api_token";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenPayload {
    pub token: String,
    pub org_name: String,
    pub org_id: String,
}

#[command]
pub async fn save_token(payload: TokenPayload) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, TOKEN_KEY).map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    entry.set_password(&json).map_err(|e| e.to_string())
}

#[command]
pub async fn load_token() -> Result<Option<TokenPayload>, String> {
    let entry = Entry::new(SERVICE_NAME, TOKEN_KEY).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(json) => {
            let payload = serde_json::from_str(&json).map_err(|e| e.to_string())?;
            Ok(Some(payload))
        }
        Err(_) => Ok(None),
    }
}

#[command]
pub async fn clear_token() -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, TOKEN_KEY).map_err(|e| e.to_string())?;
    let _ = entry.delete_credential();
    Ok(())
}
