use base64::Engine;
use reqwest::Client;
use serde_json::Value;
use std::fs;
use thiserror::Error;

#[derive(Debug, Clone)]
pub struct LcuClient {
    pub port: u16,
    pub token: String,
    client: Client,
}

#[derive(Debug, Error)]
pub enum LcuError {
    #[error("LoL is not running")]
    NotRunning,
    #[error("lockfile not found: {0}")]
    LockfileNotFound(String),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("API error: {status} - {body}")]
    Api { status: u16, body: String },
}

impl LcuClient {
    pub fn from_lockfile() -> Result<Self, LcuError> {
        let path = Self::find_lockfile()?;
        let content = fs::read_to_string(&path)
            .map_err(|_| LcuError::LockfileNotFound(path.clone()))?;

        // Format: LeagueClient:PID:PORT:TOKEN:PROTOCOL
        let colon = ':';
        let parts: Vec<&str> = content.trim().split(colon).collect();
        if parts.len() < 5 {
            return Err(LcuError::LockfileNotFound(path));
        }

        let port: u16 = parts[2].parse().map_err(|_| LcuError::NotRunning)?;
        let token = parts[3].to_string();

        let client = Client::builder()
            .danger_accept_invalid_certs(true)
            .build()
            .map_err(LcuError::Http)?;

        Ok(LcuClient { port, token, client })
    }

    fn find_lockfile() -> Result<String, LcuError> {
        if let Ok(custom) = std::env::var("LOL_LOCKFILE_PATH") {
            if std::path::Path::new(&custom).exists() {
                return Ok(custom);
            }
        }
        let candidates = vec![
            r"C:\Riot Games\League of Legends\lockfile".to_string(),
            r"C:\Program Files\Riot Games\League of Legends\lockfile".to_string(),
            r"C:\Program Files (x86)\Riot Games\League of Legends\lockfile".to_string(),
            "/Applications/League of Legends.app/Contents/LoL/lockfile".to_string(),
        ];
        for p in candidates {
            if std::path::Path::new(&p).exists() {
                return Ok(p);
            }
        }
        Err(LcuError::NotRunning)
    }

    fn auth_header(&self) -> String {
        let enc = base64::engine::general_purpose::STANDARD
            .encode(format!("riot:{}", self.token));
        format!("Basic {}", enc)
    }

    fn base_url(&self) -> String {
        format!("https://127.0.0.1:{}", self.port)
    }

    pub async fn get(&self, path: &str) -> Result<Value, LcuError> {
        let resp = self.client
            .get(format!("{}{}", self.base_url(), path))
            .header("Authorization", self.auth_header())
            .send().await?;
        let status = resp.status().as_u16();
        let body = resp.text().await?;
        if status >= 400 {
            return Err(LcuError::Api { status, body });
        }
        Ok(serde_json::from_str(&body)?)
    }

    pub async fn post(&self, path: &str, body: &Value) -> Result<Value, LcuError> {
        let resp = self.client
            .post(format!("{}{}", self.base_url(), path))
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(body).send().await?;
        let status = resp.status().as_u16();
        let text = resp.text().await?;
        if status >= 400 {
            return Err(LcuError::Api { status, body: text });
        }
        if text.is_empty() {
            return Ok(serde_json::Value::Null);
        }
        Ok(serde_json::from_str(&text)?)
    }

    pub async fn put(&self, path: &str, body: &Value) -> Result<Value, LcuError> {
        let resp = self.client
            .put(format!("{}{}", self.base_url(), path))
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/json")
            .json(body).send().await?;
        let status = resp.status().as_u16();
        let text = resp.text().await?;
        if status >= 400 {
            return Err(LcuError::Api { status, body: text });
        }
        if text.is_empty() {
            return Ok(serde_json::Value::Null);
        }
        Ok(serde_json::from_str(&text)?)
    }

    pub async fn delete(&self, path: &str) -> Result<(), LcuError> {
        let resp = self.client
            .delete(format!("{}{}", self.base_url(), path))
            .header("Authorization", self.auth_header())
            .send().await?;
        let status = resp.status().as_u16();
        if status >= 400 {
            let body = resp.text().await?;
            return Err(LcuError::Api { status, body });
        }
        Ok(())
    }
}