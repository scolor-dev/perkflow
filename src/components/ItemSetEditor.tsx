import { useState, useMemo } from "react";
import { useDataDragonContext } from "../contexts/DataDragonContext";
import type { ItemSet, ItemBlock, DDItem } from "../types";

const DEFAULT_BLOCKS = ["Starting", "Core", "Situational"];

function emptySet(): ItemSet {
  return { blocks: DEFAULT_BLOCKS.map((type) => ({ type, items: [] })) };
}

interface Props {
  value: ItemSet | undefined;
  onChange: (set: ItemSet | undefined) => void;
}

export function ItemSetEditor({ value, onChange }: Props) {
  const { items, itemIconUrl } = useDataDragonContext();
  const [open, setOpen] = useState(false);
  const [blockIdx, setBlockIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [editingName, setEditingName] = useState<number | null>(null);
  const [editNameVal, setEditNameVal] = useState("");

  const set = value ?? emptySet();

  const update = (next: ItemSet) => onChange(next);

  const curBlock: ItemBlock = set.blocks[blockIdx] ?? { type: "", items: [] };

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      if (tagFilter && !item.tags.includes(tagFilter)) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, tagFilter]);

  const addItem = (item: DDItem) => {
    const blocks = set.blocks.map((b, i) => {
      if (i !== blockIdx) return b;
      const existing = b.items.find((e) => e.id === item.id);
      if (existing) {
        return { ...b, items: b.items.map((e) => e.id === item.id ? { ...e, count: e.count + 1 } : e) };
      }
      return { ...b, items: [...b.items, { id: item.id, count: 1 }] };
    });
    update({ ...set, blocks });
  };

  const removeItem = (itemId: number) => {
    const blocks = set.blocks.map((b, i) =>
      i !== blockIdx ? b : { ...b, items: b.items.filter((e) => e.id !== itemId) }
    );
    update({ ...set, blocks });
  };

  const addBlock = () => {
    const newBlock: ItemBlock = { type: `Block ${set.blocks.length + 1}`, items: [] };
    update({ ...set, blocks: [...set.blocks, newBlock] });
    setBlockIdx(set.blocks.length);
  };

  const removeBlock = (idx: number) => {
    if (set.blocks.length <= 1) return;
    const blocks = set.blocks.filter((_, i) => i !== idx);
    update({ ...set, blocks });
    setBlockIdx(Math.min(blockIdx, blocks.length - 1));
  };

  const renameBlock = (idx: number, name: string) => {
    const blocks = set.blocks.map((b, i) => i === idx ? { ...b, type: name } : b);
    update({ ...set, blocks });
  };

  const getItem = (id: number) => items.find((i) => i.id === id);

  const TAGS = [
    { label: "全て", value: "" },
    { label: "Boots", value: "Boots" },
    { label: "Damage", value: "Damage" },
    { label: "AP", value: "SpellDamage" },
    { label: "Crit", value: "CriticalStrike" },
    { label: "HP", value: "Health" },
    { label: "Armor", value: "Armor" },
    { label: "MR", value: "SpellBlock" },
    { label: "AS", value: "AttackSpeed" },
    { label: "Mana", value: "Mana" },
    { label: "AH", value: "AbilityHaste" },
    { label: "Jungle", value: "Jungle" },
    { label: "消耗品", value: "Consumable" },
  ];

  return (
    <div className="itemset-editor">
      <button className="itemset-toggle" onClick={() => setOpen((v) => !v)}>
        <span className="itemset-toggle-label">Item Set</span>
        {value && value.blocks.some((b) => b.items.length > 0) && (
          <span className="itemset-badge">
            {value.blocks.reduce((s, b) => s + b.items.length, 0)} items
          </span>
        )}
        <span className="itemset-arrow">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="itemset-body">
          {/* Block tabs */}
          <div className="itemset-block-tabs">
            {set.blocks.map((b, i) => (
              <div key={i} className={`itemset-block-tab ${blockIdx === i ? "active" : ""}`}>
                {editingName === i ? (
                  <input
                    className="itemset-block-name-in"
                    value={editNameVal}
                    autoFocus
                    onChange={(e) => setEditNameVal(e.target.value)}
                    onBlur={() => {
                      if (editNameVal.trim()) renameBlock(i, editNameVal.trim());
                      setEditingName(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (editNameVal.trim()) renameBlock(i, editNameVal.trim());
                        setEditingName(null);
                      } else if (e.key === "Escape") {
                        setEditingName(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    className="itemset-block-tab-btn"
                    onClick={() => setBlockIdx(i)}
                    onDoubleClick={() => { setEditNameVal(b.type); setEditingName(i); }}
                  >
                    {b.type}
                    {b.items.length > 0 && <span className="itemset-block-count">{b.items.length}</span>}
                  </button>
                )}
                {set.blocks.length > 1 && (
                  <button className="itemset-block-remove" onClick={(e) => { e.stopPropagation(); removeBlock(i); }}>×</button>
                )}
              </div>
            ))}
            {set.blocks.length < 8 && (
              <button className="itemset-block-add" onClick={addBlock}>+</button>
            )}
          </div>

          {/* Current block items */}
          <div className="itemset-current-items">
            {curBlock.items.length === 0 ? (
              <span className="itemset-empty-hint">下のグリッドからアイテムを追加</span>
            ) : (
              curBlock.items.map((entry) => {
                const item = getItem(entry.id);
                if (!item) return null;
                return (
                  <div key={entry.id} className="itemset-slot" title={item.name} onClick={() => removeItem(entry.id)}>
                    <img src={itemIconUrl(item)} alt={item.name} />
                    {entry.count > 1 && <span className="itemset-slot-count">{entry.count}</span>}
                  </div>
                );
              })
            )}
          </div>

          {/* Divider */}
          <div className="itemset-divider" />

          {/* Search + tag filter */}
          <div className="itemset-search-row">
            <input
              className="itemset-search"
              type="text"
              placeholder="アイテム検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="itemset-search-clear" onClick={() => setSearch("")}>×</button>
            )}
          </div>
          <div className="itemset-tags">
            {TAGS.map((t) => (
              <button
                key={t.value}
                className={`itemset-tag ${tagFilter === t.value ? "active" : ""}`}
                onClick={() => setTagFilter(t.value === tagFilter ? "" : t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Item grid */}
          <div className="itemset-grid">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                className="itemset-item-btn"
                title={`${item.name} (${item.gold.total}g)`}
                onClick={() => addItem(item)}
              >
                <img src={itemIconUrl(item)} alt={item.name} loading="lazy" />
              </button>
            ))}
          </div>

          {/* Clear button */}
          {value && value.blocks.some((b) => b.items.length > 0) && (
            <button className="itemset-clear" onClick={() => onChange(undefined)}>
              アイテムセットをクリア
            </button>
          )}
        </div>
      )}
    </div>
  );
}
