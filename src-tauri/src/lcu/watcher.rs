use std::sync::atomic::{AtomicI64, Ordering};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio_tungstenite::{connect_async_tls_with_config, tungstenite::Message, Connector};

use super::client::LcuClient;
use super::runes::apply_champion_runes;
use crate::commands::get_saved_runes;

static LAST_CHAMP: AtomicI64 = AtomicI64::new(0);

pub async fn start_watcher(handle: AppHandle) {
    loop {
        match LcuClient::from_lockfile() {
            Ok(client) => {
                let _ = handle.emit("lcu-status",
                    serde_json::json!({ "connected": true, "port": client.port }));
                log::info!("LCU connected port={}", client.port);
                if let Err(e) = run_ws(&client, &handle).await {
                    log::warn!("WS disconnected: {}", e);
                }
                let _ = handle.emit("lcu-status",
                    serde_json::json!({ "connected": false }));
                // Champion Select 終了時にリセット
                LAST_CHAMP.store(0, Ordering::Relaxed);
            }
            Err(_) => {}
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }
}

async fn run_ws(
    client: &LcuClient,
    handle: &AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use base64::Engine;
    let auth = base64::engine::general_purpose::STANDARD
        .encode(format!("riot:{}", client.token));

    let req = tokio_tungstenite::tungstenite::http::Request::builder()
        .uri(format!("wss://127.0.0.1:{}/", client.port))
        .header("Authorization", format!("Basic {}", auth))
        .header("Host", format!("127.0.0.1:{}", client.port))
        .header("Upgrade", "websocket")
        .header("Connection", "Upgrade")
        .header("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
        .header("Sec-WebSocket-Version", "13")
        .body(())?;

    let connector = Connector::NativeTls(
        native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(true)
            .build()?
    );

    let (ws, _) = connect_async_tls_with_config(
        req, None, false, Some(connector)
    ).await?;
    let (mut write, mut read) = ws.split();

    // Champion Select セッションを購読
    write.send(Message::Text(
        serde_json::json!([5, "OnJsonApiEvent_lol-champ-select_v1_session"])
            .to_string().into()
    )).await?;

    while let Some(msg) = read.next().await {
        match msg? {
            Message::Text(txt) => {
                if let Ok(event) = serde_json::from_str::<Value>(&txt) {
                    handle_event(&event, client, handle).await;
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
    Ok(())
}

async fn handle_event(event: &Value, client: &LcuClient, handle: &AppHandle) {
    // イベント形式: [8, "OnJsonApiEvent_...", { eventType, uri, data }]
    let data = match event.get(2).and_then(|v| v.get("data")) {
        Some(d) => d,
        None => return,
    };

    // localPlayerCellId で自分のセルを特定（サモナーID取得不要）
    let my_cell_id = match data.get("localPlayerCellId").and_then(|v| v.as_i64()) {
        Some(id) => id,
        None => return,
    };

    // myTeam と theirTeam 両方から自分のセルを探す
    let champ_id = find_champ_in_team(data, "myTeam", my_cell_id)
        .or_else(|| find_champ_in_team(data, "theirTeam", my_cell_id))
        .unwrap_or(0);

    if champ_id == 0 {
        // キャラ未選択（ホバー前）
        // IDが0に戻った = Champion Select を出た
        if LAST_CHAMP.load(Ordering::Relaxed) != 0 {
            LAST_CHAMP.store(0, Ordering::Relaxed);
            let _ = handle.emit("champion-cleared", serde_json::json!({}));
        }
        return;
    }

    // 同じキャラが連続で来た場合はスキップ
    let last = LAST_CHAMP.swap(champ_id, Ordering::Relaxed);
    if last == champ_id {
        return;
    }

    log::info!("Champion changed: {} -> {}", last, champ_id);

    // フロントに通知
    let _ = handle.emit("champion-changed",
        serde_json::json!({ "championId": champ_id }));

    // 保存済みルーンがあれば自動適用
    if let Some(runes) = get_saved_runes(handle, champ_id) {
        log::info!("Auto-applying runes for champion={}", champ_id);
        match apply_champion_runes(client, &runes).await {
            Ok(_) => {
                let _ = handle.emit("runes-applied", serde_json::json!({
                    "championId": champ_id,
                    "championName": runes.champion_name,
                    "pageCount": runes.pages.len(),
                }));
            }
            Err(e) => {
                log::error!("Failed to apply runes: {}", e);
                let _ = handle.emit("runes-error",
                    serde_json::json!({ "error": e.to_string() }));
            }
        }
    } else {
        let _ = handle.emit("runes-not-found",
            serde_json::json!({ "championId": champ_id }));
    }
}

fn find_champ_in_team(data: &Value, team_key: &str, cell_id: i64) -> Option<i64> {
    let team = data.get(team_key)?.as_array()?;
    let entry = team.iter().find(|e| {
        e.get("cellId")
            .and_then(|id| id.as_i64())
            .map(|id| id == cell_id)
            .unwrap_or(false)
    })?;

    // championId が 0 より大きい場合のみ返す
    // ホバー中は championId に値が入る
    let champ_id = entry.get("championId")
        .and_then(|id| id.as_i64())
        .unwrap_or(0);

    if champ_id > 0 { Some(champ_id) } else { None }
}