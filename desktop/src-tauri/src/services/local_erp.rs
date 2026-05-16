use std::time::Duration;

pub async fn ping_http_base(base_url: &str) -> bool {
    let base = base_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return false;
    }

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    let health = format!("{}/health", base);
    let root = base.to_string();

    for url in [health, root] {
        if client
            .get(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
        {
            return true;
        }
    }

    false
}
