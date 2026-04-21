use serde::{Deserialize, Serialize};
use serde_json::json;
use super::client::{LcuClient, LcuError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemEntry {
    pub id: i64,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemBlock {
    #[serde(rename = "type")]
    pub block_type: String,
    pub items: Vec<ItemEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemSet {
    pub blocks: Vec<ItemBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunePage {
    pub name: String,
    #[serde(rename = "primaryStyleId")]
    pub primary_style_id: i64,
    #[serde(rename = "subStyleId")]
    pub sub_style_id: i64,
    #[serde(rename = "selectedPerkIds")]
    pub selected_perk_ids: Vec<i64>,
    #[serde(rename = "itemSet", default)]
    pub item_set: Option<ItemSet>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChampionRunes {
    #[serde(rename = "championId")]
    pub champion_id: i64,
    #[serde(rename = "championName")]
    pub champion_name: String,
    #[serde(default)]
    pub lane: Option<String>,
    pub pages: Vec<RunePage>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct LcuRunePage {
    pub id: i64,
    pub name: String,
    #[serde(rename = "primaryStyleId")]
    pub primary_style_id: i64,
    #[serde(rename = "subStyleId")]
    pub sub_style_id: i64,
    #[serde(rename = "selectedPerkIds")]
    pub selected_perk_ids: Vec<i64>,
    #[serde(rename = "isEditable", default)]
    pub is_editable: bool,
    #[serde(rename = "isActive", default)]
    pub is_active: bool,
}

pub async fn get_rune_pages(client: &LcuClient) -> Result<Vec<LcuRunePage>, LcuError> {
    let resp = client.get("/lol-perks/v1/pages").await?;
    Ok(serde_json::from_value(resp)?)
}

pub async fn delete_editable_pages(client: &LcuClient) -> Result<(), LcuError> {
    let pages = get_rune_pages(client).await?;
    for page in pages.iter().filter(|p| p.is_editable) {
        let _ = client.delete(&format!("/lol-perks/v1/pages/{}", page.id)).await;
        tokio::time::sleep(tokio::time::Duration::from_millis(120)).await;
    }
    Ok(())
}

pub async fn create_rune_page(client: &LcuClient, page: &RunePage) -> Result<LcuRunePage, LcuError> {
    let body = json!({
        "name": page.name,
        "primaryStyleId": page.primary_style_id,
        "subStyleId": page.sub_style_id,
        "selectedPerkIds": page.selected_perk_ids,
        "current": true,
        "isActive": false,
        "isEditable": true,
        "isValid": true,
        "order": 0,
    });
    let resp = client.post("/lol-perks/v1/pages", &body).await?;
    Ok(serde_json::from_value(resp)?)
}

pub async fn apply_champion_runes(client: &LcuClient, runes: &ChampionRunes) -> Result<(), LcuError> {
    delete_editable_pages(client).await?;
    for page in &runes.pages {
        create_rune_page(client, page).await?;
        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
    }
    Ok(())
}
