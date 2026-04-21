import { useState, useEffect } from "react";
import type { PerkStyle, DDItem } from "../types";

const DD_BASE_ROOT = "https://ddragon.leagueoflegends.com";

export interface Champion {
  id: string;
  key: string;
  name: string;
  image: { full: string };
}

export function useDataDragon() {
  const [runeStyles, setRuneStyles] = useState<PerkStyle[]>([]);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [items, setItems] = useState<DDItem[]>([]);
  const [version, setVersion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // 最新バージョンを自動取得
        const versions: string[] = await fetch(
          `${DD_BASE_ROOT}/api/versions.json`
        ).then((r) => r.json());
        const latest = versions[0];
        setVersion(latest);

        const base = `${DD_BASE_ROOT}/cdn/${latest}`;

        const [runeData, champData, itemData] = await Promise.all([
          fetch(`${base}/data/ja_JP/runesReforged.json`).then((r) => r.json()),
          fetch(`${base}/data/ja_JP/champion.json`).then((r) => r.json()),
          fetch(`${base}/data/ja_JP/item.json`).then((r) => r.json()),
        ]);

        setRuneStyles(runeData);
        const list: Champion[] = Object.values(champData.data);
        list.sort((a, b) => a.name.localeCompare(b.name, "ja"));
        setChampions(list);

        const seen = new Set<string>();
        const itemList: DDItem[] = Object.entries(itemData.data)
          .map(([id, raw]) => ({ id: parseInt(id), ...(raw as Omit<DDItem, "id">) }))
          .filter((item) =>
            item.gold.purchasable &&
            item.inStore !== false &&
            !item.hideFromAll &&
            (item.maps["11"] || item.maps["12"])
          )
          .sort((a, b) => a.gold.total - b.gold.total)
          .filter((item) => {
            if (seen.has(item.name)) return false;
            seen.add(item.name);
            return true;
          });
        setItems(itemList);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getChampionById = (id: number) =>
    champions.find((c) => parseInt(c.key) === id);

  const champIconUrl = (c: Champion) =>
    `${DD_BASE_ROOT}/cdn/${version}/img/champion/${c.image.full}`;

  const runeIconUrl = (icon: string) =>
    `${DD_BASE_ROOT}/cdn/img/${icon}`;

  const itemIconUrl = (item: DDItem) =>
    `${DD_BASE_ROOT}/cdn/${version}/img/item/${item.image.full}`;

  return {
    runeStyles,
    champions,
    items,
    loading,
    error,
    getChampionById,
    champIconUrl,
    runeIconUrl,
    itemIconUrl,
  };
}
