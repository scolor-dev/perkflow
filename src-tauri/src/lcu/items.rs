use serde_json::{json, Value};
use super::client::{LcuClient, LcuError};
use super::runes::ChampionRunes;

async fn get_summoner_id(client: &LcuClient) -> Result<i64, LcuError> {
    let summoner = client.get("/lol-summoner/v1/current-summoner").await?;
    summoner.get("summonerId")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| LcuError::Api { status: 0, body: "No summonerId".into() })
}

pub async fn apply_champion_item_sets(
    client: &LcuClient,
    runes: &ChampionRunes,
) -> Result<(), LcuError> {
    let champion_id = runes.champion_id;
    let pages_with_items: Vec<_> = runes.pages.iter()
        .filter(|p| p.item_set.as_ref().map(|s| !s.blocks.is_empty()).unwrap_or(false))
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

    // Remove existing item sets for this champion
    sets.retain(|s| {
        s.get("associatedChampions")
            .and_then(|v| v.as_array())
            .map(|arr| !arr.iter().any(|id| id.as_i64() == Some(champion_id)))
            .unwrap_or(true)
    });

    // Add new item sets from each rune page
    for page in pages_with_items {
        let item_set = page.item_set.as_ref().unwrap();
        let blocks: Vec<Value> = item_set.blocks.iter().map(|b| {
            json!({
                "type": b.block_type,
                "items": b.items.iter().map(|i| {
                    json!({ "id": i.id.to_string(), "count": i.count })
                }).collect::<Vec<_>>()
            })
        }).collect();

        sets.push(json!({
            "title": &page.name,
            "associatedChampions": [champion_id],
            "associatedMaps": [11, 12, 21],
            "blocks": blocks,
        }));
    }

    let payload = json!({ "itemSets": sets, "timestamp": 0 });
    client.put(
        &format!("/lol-item-sets/v1/item-sets/{}/sets", summoner_id),
        &payload,
    ).await?;

    Ok(())
}
