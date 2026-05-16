use std::time::Duration;

pub fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .expect("reqwest client")
}

pub async fn ping_cloud_health(client: &reqwest::Client, api_url: &str, token: &str) -> bool {
    let base = api_url.trim().trim_end_matches('/');
    let url = format!("{}/health", base);
    client
        .get(url)
        .bearer_auth(token)
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}
