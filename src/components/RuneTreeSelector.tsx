import { useState } from "react";
import type { PerkSlot, PerkStyle, RunePage, Perk } from "../types";
import { STAT_SHARDS } from "../types";

interface Props {
  runeStyles: PerkStyle[];
  runeIconUrl: (path: string) => string;
  value: Partial<RunePage>;
  onChange: (page: Partial<RunePage>) => void;
}

const TREE_COLOR: Record<number, string> = {
  8000: "#c89b3c",
  8100: "#be3c28",
  8200: "#9f8fe2",
  8300: "#41b3bc",
  8400: "#4f9c3e",
};

// 外部HTMLを安全なプレーンテキストに変換（XSS対策）
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent ?? "";
}

// バージョン差吸収: slot.runes (新) または slot.perks (旧)
function getPerks(slot: PerkSlot): Perk[] {
  return slot.runes ?? slot.perks ?? [];
}

function ensureLength(arr: number[], len = 9): number[] {
  const result = [...arr];
  while (result.length < len) result.push(0);
  return result;
}

export function RuneTreeSelector({ runeStyles, runeIconUrl, value, onChange }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const primary = runeStyles.find((s) => s.id === value.primaryStyleId);
  const sub     = runeStyles.find((s) => s.id === value.subStyleId);
  const perks   = ensureLength(value.selectedPerkIds ?? []);

  const setPrimary = (id: number) =>
    onChange({ ...value, primaryStyleId: id, subStyleId: undefined, selectedPerkIds: [] });

  const setSub = (id: number) => {
    const ids = ensureLength(perks);
    ids[4] = 0;
    ids[5] = 0;
    onChange({ ...value, subStyleId: id, selectedPerkIds: ids });
  };

  const setMainPerk = (perkId: number, slotIndex: number) => {
    const ids = ensureLength(perks);
    ids[slotIndex] = perkId;
    onChange({ ...value, selectedPerkIds: ids });
  };

  const setSubPerk = (perkId: number, rowIndex: number) => {
    const ids = ensureLength(perks);
    const rowPerkIds = sub?.slots.slice(1)[rowIndex]
      ? getPerks(sub.slots.slice(1)[rowIndex]).map((p) => p.id)
      : [];

    if (rowPerkIds.includes(ids[4])) {
      ids[4] = perkId;
    } else if (rowPerkIds.includes(ids[5])) {
      ids[5] = perkId;
    } else if (ids[4] === 0) {
      ids[4] = perkId;
    } else if (ids[5] === 0) {
      ids[5] = perkId;
    } else {
      ids[4] = ids[5];
      ids[5] = perkId;
    }
    onChange({ ...value, selectedPerkIds: ids });
  };

  const setStat = (perkId: number, rowIndex: number) => {
    const ids = ensureLength(perks);
    ids[6 + rowIndex] = perkId;
    onChange({ ...value, selectedPerkIds: ids });
  };

  const color = value.primaryStyleId ? TREE_COLOR[value.primaryStyleId] ?? "#aaa" : "#aaa";

  if (!runeStyles || runeStyles.length === 0) {
    return <div style={{ color: "var(--txm)", padding: "20px" }}>Loading rune data...</div>;
  }

  return (
    <div className="rune-selector">
      {/* メインツリー選択バー */}
      <div className="tree-bar">
        <span className="tree-bar-label">Main</span>
        {runeStyles.map((s) => (
          <button
            key={s.id}
            className={`tree-btn ${value.primaryStyleId === s.id ? "active" : ""}`}
            style={value.primaryStyleId === s.id ? { borderColor: TREE_COLOR[s.id] } : {}}
            onClick={() => setPrimary(s.id)}
            title={s.name}
          >
            <img src={runeIconUrl(s.icon)} alt={s.name} />
          </button>
        ))}
      </div>

      <div className="rune-cols">
        {/* ── メイン列 ── */}
        <div className="rune-col">
          <div className="col-head" style={{ color }}>
            {primary?.name ?? "Select a tree"}
          </div>

          {primary?.slots?.map((slot, si) => {
            const slotPerks = getPerks(slot);
            return (
              <div key={si} className={`perk-row ${si === 0 ? "keystone-row" : ""}`}>
                {slotPerks.map((perk) => {
                  const sel = perks[si] === perk.id;
                  return (
                    <div key={perk.id} className="perk-wrap">
                      <button
                        className={`perk-btn ${si === 0 ? "keystone" : ""} ${sel ? "sel" : ""}`}
                        style={sel ? { borderColor: color, boxShadow: `0 0 8px ${color}55` } : {}}
                        onClick={() => setMainPerk(perk.id, si)}
                        onMouseEnter={() => setHovered(perk.id)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        <img src={runeIconUrl(perk.icon)} alt={perk.name} />
                      </button>
                      {hovered === perk.id && (
                        <div className="tooltip">
                          <div className="tt-name">{perk.name}</div>
                          <div className="tt-desc">{stripHtml(perk.shortDesc)}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* スタッツ */}
          {primary && (
            <div className="stats-block">
              <div className="stats-title">Stats</div>
              {(["row1", "row2", "row3"] as const).map((row, ri) => (
                <div key={row} className="stat-row">
                  {STAT_SHARDS[row].map((sh, si) => {
                    const sel = perks[6 + ri] === sh.id;
                    return (
                      <button
                        key={`${row}-${si}`}
                        className={`stat-btn ${sel ? "sel" : ""}`}
                        style={sel ? { borderColor: color } : {}}
                        onClick={() => setStat(sh.id, ri)}
                      >
                        <span className="stat-dot" style={sel ? { background: color } : {}} />
                        {sh.name}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── サブ列 ── */}
        {primary && (
          <div className="rune-col sub-col">
            <div className="col-head">Secondary</div>

            <div className="sub-tree-bar">
              {runeStyles
                .filter((s) => s.id !== value.primaryStyleId)
                .map((s) => (
                  <button
                    key={s.id}
                    className={`tree-btn sm ${value.subStyleId === s.id ? "active" : ""}`}
                    style={value.subStyleId === s.id ? { borderColor: TREE_COLOR[s.id] } : {}}
                    onClick={() => setSub(s.id)}
                    title={s.name}
                  >
                    <img src={runeIconUrl(s.icon)} alt={s.name} />
                  </button>
                ))}
            </div>

            {sub?.slots && (
              <>
                <div className="col-head" style={{ color: TREE_COLOR[sub.id] }}>
                  {sub.name}
                </div>
                {sub.slots.slice(1).map((slot, rowIndex) => {
                  const slotPerks = getPerks(slot);
                  return (
                    <div key={rowIndex} className="perk-row">
                      {slotPerks.map((perk) => {
                        const sel = perks[4] === perk.id || perks[5] === perk.id;
                        const sc = TREE_COLOR[sub.id] ?? "#aaa";
                        return (
                          <div key={perk.id} className="perk-wrap">
                            <button
                              className={`perk-btn sm ${sel ? "sel" : ""}`}
                              style={sel ? { borderColor: sc, boxShadow: `0 0 6px ${sc}55` } : {}}
                              onClick={() => setSubPerk(perk.id, rowIndex)}
                              onMouseEnter={() => setHovered(perk.id)}
                              onMouseLeave={() => setHovered(null)}
                            >
                              <img src={runeIconUrl(perk.icon)} alt={perk.name} />
                            </button>
                            {hovered === perk.id && (
                              <div className="tooltip tooltip-r">
                                <div className="tt-name">{perk.name}</div>
                                <div className="tt-desc">{stripHtml(perk.shortDesc)}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}