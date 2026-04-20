use std::sync::atomic::{AtomicI64, Ordering};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio_tungstenite::{connect_async_tls_with_config, tungstenite::Message, Connector};

use super::client::LcuClient;
use super::runes::apply_champion_runes;
use crate::commands::get_saved_runes;

static LAST_CHAMP: AtomicI64 = AtomicI64::new(0);
static LAST_LANE: AtomicI64 = AtomicI64::new(0);

fn lane_to_id(lane: Option<&str>) -> i64 {
    match lane {
        Some("top") => 1,
        Some("jungle") => 2,
        Some("mid") => 3,
        Some("bot") => 4,
        Some("support") => 5,
        _ => 0,
    }
}

fn lcu_position_to_lane(pos: &str) -> Option<String> {
    match pos.to_uppercase().as_str() {
        "TOP" => Some("top".to_string()),
        "JUNGLE" => Some("jungle".to_string()),
        "MIDDLE" | "MID" => Some("mid".to_string()),
        "BOTTOM" | "BOT" | "ADC" => Some("bot".to_string()),
        "UTILITY" | "SUPPORT" | "SUP" => Some("support".to_string()),
        _ => None,
    }
}

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
                LAST_CHAMP.store(0, Ordering::Relaxed);
                LAST_LANE.store(0, Ordering::Relaxed);
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
    let data = match event.get(2).and_then(|v| v.get("data")) {
        Some(d) => d,
        None => return,
    };

    let my_cell_id = match data.get("localPlayerCellId").and_then(|v| v.as_i64()) {
        Some(id) => id,
        None => return,
    };

    let result = find_champ_in_team(data, "myTeam", my_cell_id)
        .or_else(|| find_champ_in_team(data, "theirTeam", my_cell_id));

    let (champ_id, lane) = match result {
        Some(r) => r,
        None => (0, None),
    };

    if champ_id == 0 {
        if LAST_CHAMP.load(Ordering::Relaxed) != 0 {
            LAST_CHAMP.store(0, Ordering::Relaxed);
            LAST_LANE.store(0, Ordering::Relaxed);
            let _ = handle.emit("champion-cleared", serde_json::json!({}));
        }
        return;
    }

    let lane_id = lane_to_id(lane.as_deref());
    let last_champ = LAST_CHAMP.load(Ordering::Relaxed);
    let last_lane = LAST_LANE.load(Ordering::Relaxed);

    if last_champ == champ_id && last_lane == lane_id {
        return;
    }

    LAST_CHAMP.store(champ_id, Ordering::Relaxed);
    LAST_LANE.store(lane_id, Ordering::Relaxed);

    log::info!("Champion changed: {}:{:?} -> {}:{:?}", last_champ, last_lane, champ_id, lane);

    let _ = handle.emit("champion-changed", serde_json::json!({
        "championId": champ_id,
        "lane": lane,
    }));

    if let Some(runes) = get_saved_runes(handle, champ_id, lane.as_deref()) {
        log::info!("Auto-applying runes for champion={} lane={:?}", champ_id, lane);
        match apply_champion_runes(client, &runes).await {
            Ok(_) => {
                let _ = handle.emit("runes-applied", serde_json::json!({
                    "championId": champ_id,
                    "championName": runes.champion_name,
                    "lane": runes.lane,
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
            serde_json::json!({ "championId": champ_id, "lane": lane }));
    }
}

fn find_champ_in_team(data: &Value, team_key: &str, cell_id: i64) -> Option<(i64, Option<String>)> {
    let team = data.get(team_key)?.as_array()?;
    let entry = team.iter().find(|e| {
        e.get("cellId").and_then(|id| id.as_i64()) == Some(cell_id)
    })?;

    let champ_id = entry.get("championPickIntent")
        .and_then(|id| id.as_i64())
        .filter(|&id| id > 0)
        .or_else(|| entry.get("championId").and_then(|id| id.as_i64()).filter(|&id| id > 0))
        .unwrap_or(0);
    if champ_id <= 0 { return None; }

    let lane = entry.get("assignedPosition")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .and_then(lcu_position_to_lane);

    Some((champ_id, lane))
}
