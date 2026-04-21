use std::time::{SystemTime, UNIX_EPOCH};
use serde_json::{json, Value};
use super::client::{LcuClient, LcuError};
use super::runes::ChampionRunes;

async fn get_summoner_id(client: &LcuClient) -> Result<i64, LcuError> {
    let summoner = client.get("/lol-summoner/v1/current-summoner").await?;
    summoner.get("summonerId")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| LcuError::Api { status: 0, body: "No summonerId".into() })
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub async fn apply_champion_item_sets(
    client: &LcuClient,
    runes: &ChampionRunes,
) -> Result<(), LcuError> {
    let champion_id = runes.champion_id;

    // アイテムが1つ以上あるページのみ対象
    let pages_with_items: Vec<_> = runes.pages.iter()
        .filter(|p| {
            p.item_set.as_ref().map(|s| {
                s.blocks.iter().any(|b| !b.items.is_empty())
            }).unwrap_or(false)
        })
        .collect();

    if pages_with_items.is_empty() {
        return Ok(());
    }

    let summoner_id = get_summoner_id(client).await?;

    let existing = client
        .get(&format!("/lol-item-sets/v1/item-sets/{}/sets", summoner_id))
        .await
        .unwrap_or_else(|_| json!({ "itemSets": [], "timestamp": 0 }));

    let mut sets: Vec<Value> = existing
        .get("itemSets")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    // このチャンピオンの既存アイテムセットを削除
    sets.retain(|s| {
        s.get("associatedChampions")
            .and_then(|v| v.as_array())
            .map(|arr| !arr.iter().any(|id| id.as_i64() == Some(champion_id)))
            .unwrap_or(true)
    });

    let ts = now_ms();

    for (idx, page) in pages_with_items.iter().enumerate() {
        let item_set = page.item_set.as_ref().unwrap();

        let blocks: Vec<Value> = item_set.blocks.iter()
            .filter(|b| !b.items.is_empty())
            .map(|b| json!({
                "type": b.block_type,
                "items": b.items.iter().map(|i| {
                    json!({ "id": i.id.to_string(), "count": i.count })
                }).collect::<Vec<_>>()
            }))
            .collect();

        // LCU APIに必要なフィールドをすべて含める
        sets.push(json!({
            "uid": format!("{}-{}-{}", ts, champion_id, idx),
            "title": &page.name,
            "type": "custom",
            "map": "any",
            "mode": "any",
            "priority": false,
            "sortrank": 0,
            "associatedChampions": [champion_id],
            "associatedMaps": [11, 12, 21],
            "blocks": blocks,
        }));
    }

    let payload = json!({ "itemSets": sets, "timestamp": ts });
    client.put(
        &format!("/lol-item-sets/v1/item-sets/{}/sets", summoner_id),
        &payload,
    ).await?;

    Ok(())
}
