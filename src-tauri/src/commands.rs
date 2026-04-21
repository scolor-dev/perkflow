use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use serde_json::json;

use crate::lcu::{
    client::LcuClient,
    items::apply_champion_item_sets,
    runes::{apply_champion_runes, get_rune_pages, ChampionRunes, LcuRunePage},
};

const STORE_FILE: &str = "runes.json";
const RUNES_KEY: &str = "champion_runes";

/// チャンピオン+レーンで検索し、未登録時はチャンピオンのみでフォールバック
pub fn get_saved_runes(app: &AppHandle, champion_id: i64, lane: Option<&str>) -> Option<ChampionRunes> {
    let store = app.store(STORE_FILE).ok()?;
    let all: Vec<ChampionRunes> = store.get(RUNES_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    // 1. チャンピオン+レーン 完全一致
    if let Some(lane) = lane {
        if let Some(found) = all.iter().find(|r| {
            r.champion_id == champion_id && r.lane.as_deref() == Some(lane)
        }) {
            return Some(found.clone());
        }
    }

    // 2. フォールバック: チャンピオンのみ（レーンなし or 任意）
    all.into_iter().find(|r| r.champion_id == champion_id)
}

#[tauri::command]
pub async fn get_lcu_status() -> serde_json::Value {
    match LcuClient::from_lockfile() {
        Ok(c) => json!({ "connected": true, "port": c.port }),
        Err(e) => json!({ "connected": false, "error": e.to_string() }),
    }
}

#[tauri::command]
pub async fn get_current_rune_pages() -> Result<Vec<LcuRunePage>, String> {
    let client = LcuClient::from_lockfile().map_err(|e| e.to_string())?;
    get_rune_pages(&client).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_champion_runes(
    app: AppHandle,
    champion_runes: ChampionRunes,
) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let mut all: Vec<ChampionRunes> = store.get(RUNES_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    // championId + lane の複合キーで一致するものを更新
    if let Some(ex) = all.iter_mut().find(|r| {
        r.champion_id == champion_runes.champion_id && r.lane == champion_runes.lane
    }) {
        *ex = champion_runes;
    } else {
        all.push(champion_runes);
    }
    store.set(RUNES_KEY, json!(all));
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_champion_runes(
    app: AppHandle,
    champion_id: i64,
    lane: Option<String>,
) -> Result<Option<ChampionRunes>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let all: Vec<ChampionRunes> = store.get(RUNES_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    Ok(all.into_iter().find(|r| r.champion_id == champion_id && r.lane == lane))
}

#[tauri::command]
pub async fn get_all_champion_runes(app: AppHandle) -> Result<Vec<ChampionRunes>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    Ok(store.get(RUNES_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default())
}

#[tauri::command]
pub async fn delete_champion_runes(
    app: AppHandle,
    champion_id: i64,
    lane: Option<String>,
) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let mut all: Vec<ChampionRunes> = store.get(RUNES_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    all.retain(|r| !(r.champion_id == champion_id && r.lane == lane));
    store.set(RUNES_KEY, json!(all));
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn apply_runes_manually(
    app: AppHandle,
    champion_id: i64,
    lane: Option<String>,
) -> Result<(), String> {
    let client = LcuClient::from_lockfile().map_err(|e| e.to_string())?;
    let runes = get_saved_runes(&app, champion_id, lane.as_deref())
        .ok_or_else(|| format!("No runes for champion {}", champion_id))?;
    apply_champion_runes(&client, &runes).await.map_err(|e| e.to_string())?;
    apply_champion_item_sets(&client, &runes).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn apply_item_sets_manually(
    app: AppHandle,
    champion_id: i64,
    lane: Option<String>,
) -> Result<(), String> {
    let client = LcuClient::from_lockfile().map_err(|e| e.to_string())?;
    let runes = get_saved_runes(&app, champion_id, lane.as_deref())
        .ok_or_else(|| format!("No runes for champion {}", champion_id))?;
    apply_champion_item_sets(&client, &runes).await.map_err(|e| e.to_string())
}
