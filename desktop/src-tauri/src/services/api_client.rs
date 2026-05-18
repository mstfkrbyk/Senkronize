use std::time::Duration;

use serde::Deserialize;

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

#[derive(Debug, Deserialize)]
struct PagedTotal {
    total: Option<u64>,
}

pub async fn count_orders_since(
    client: &reqwest::Client,
    api_url: &str,
    token: &str,
    start_date: &str,
) -> Option<u64> {
    let base = api_url.trim().trim_end_matches('/');
    let url = format!("{}/api/v1/orders", base);
    let response = client
        .get(url)
        .bearer_auth(token)
        .query(&[("startDate", start_date), ("limit", "1"), ("page", "1")])
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let body: PagedTotal = response.json().await.ok()?;
    body.total
}

pub async fn count_listings_last_sync_since(
    client: &reqwest::Client,
    api_url: &str,
    token: &str,
    since_iso: &str,
) -> Option<u64> {
    let base = api_url.trim().trim_end_matches('/');
    let url = format!("{}/api/v1/listings", base);
    let response = client
        .get(url)
        .bearer_auth(token)
        .query(&[
            ("lastSyncAtSince", since_iso),
            ("limit", "1"),
            ("page", "1"),
        ])
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let body: PagedTotal = response.json().await.ok()?;
    body.total
}
