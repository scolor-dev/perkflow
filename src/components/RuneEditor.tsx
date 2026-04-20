import { useState, useEffect, useCallback } from "react";
import { useDataDragonContext } from "../contexts/DataDragonContext";
import { useChampionContext } from "../contexts/ChampionContext";
import type { RunePage, ChampionRunes } from "../types";
import { RuneTreeSelector } from "./RuneTreeSelector";
import { RuneSharePanel } from "./RuneSharePanel";
import { LaneSelect } from "./LaneSelect";
import { saveChampionRunes, getChampionRunes, deleteChampionRunes, applyRunesManually } from "../hooks/useLcu";

const blank = (): Partial<RunePage> => ({
  name: "", primaryStyleId: undefined, subStyleId: undefined, selectedPerkIds: []
});

export function RuneEditor() {
  const { runeStyles, runeIconUrl, champIconUrl } = useDataDragonContext();
  const { selectedChampion: champion, selectedLane: lane, setSelectedLane, savedRunes, refreshSaved } = useChampionContext();
  const [tab, setTab] = useState(0);
  const [pages, setPages] = useState<Partial<RunePage>[]>([blank(), blank(), blank()]);
  const [status, setStatus] = useState<"idle"|"saving"|"saved"|"applying">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!champion || !lane) { setPages([blank(), blank(), blank()]); return; }
    getChampionRunes(parseInt(champion.key), lane).then((data) => {
      if (data) {
        const loaded = [blank(), blank(), blank()];
        data.pages.forEach((p, i) => { if (i < 3) loaded[i] = p; });
        setPages(loaded);
      } else {
        setPages([blank(), blank(), blank()]);
      }
    });
  }, [champion, lane]);

  const updatePage = useCallback((i: number, page: Partial<RunePage>) => {
    setPages((prev) => { const n = [...prev]; n[i] = page; return n; });
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const handleSave = async () => {
    if (!champion || !lane) return;
    const valid = pages.filter(
      (p) => p.primaryStyleId && p.subStyleId &&
        (p.selectedPerkIds?.filter((id) => id > 0).length ?? 0) >= 6
    ) as RunePage[];
    if (!valid.length) { flash("Select main/sub tree and at least 6 runes"); return; }
    setStatus("saving");
    try {
      const runes: ChampionRunes = {
        championId: parseInt(champion.key),
        championName: champion.name,
        lane,
        pages: valid.map((p, i) => ({ ...p, name: p.name || `${champion.name} ${lane.toUpperCase()} - Page ${i + 1}` })),
      };
      await saveChampionRunes(runes);
      setStatus("saved");
      flash("Saved!");
      setTimeout(() => setStatus("idle"), 2000);
      refreshSaved();
    } catch (e) { flash(`Save failed: ${e}`); setStatus("idle"); }
  };

  const handleDelete = async () => {
    if (!champion || !lane || !confirm(`Delete runes for ${champion.name} (${lane.toUpperCase()})?`)) return;
    try {
      await deleteChampionRunes(parseInt(champion.key), lane);
      setPages([blank(), blank(), blank()]);
      flash("Deleted");
      refreshSaved();
    } catch (e) { flash(`Delete failed: ${e}`); }
  };

  const handleApply = async () => {
    if (!champion || !lane) return;
    setStatus("applying");
    try {
      await applyRunesManually(parseInt(champion.key), lane);
      flash("Applied to LoL!");
    } catch (e) { flash(`Apply failed: ${e}`); }
    setStatus("idle");
  };

  if (!champion) return (
    <div className="editor-empty">
      <div className="empty-icon">+</div>
      <p>Select a champion</p>
    </div>
  );

  const cur = pages[tab];
  const hasData = (p: Partial<RunePage>) =>
    !!p.primaryStyleId && (p.selectedPerkIds?.length ?? 0) > 0;

  return (
    <div className="rune-editor">
      <div className="editor-hdr">
        <img className="champ-portrait" src={champIconUrl(champion)} alt={champion.name} />
        <div>
          <h2 className="champ-title">{champion.name}</h2>
          <div className="champ-sub">
            {lane ? `${lane.toUpperCase()} — Rune pages (max 3)` : "Select a lane"}
          </div>
        </div>
        {lane && (
          <div className="editor-btns">
            <button className="btn-apply" onClick={handleApply} disabled={status === "applying"}>
              {status === "applying" ? "Applying..." : "Apply Now"}
            </button>
            <button className="btn-del" onClick={handleDelete}>Delete</button>
            <button className={`btn-save ${status === "saved" ? "saved" : ""}`}
              onClick={handleSave} disabled={status === "saving"}>
              {status === "saving" ? "Saving..." : status === "saved" ? "Saved!" : "Save"}
            </button>
          </div>
        )}
      </div>

      <LaneSelect
        selected={lane}
        onChange={setSelectedLane}
        savedRunes={savedRunes}
        championId={parseInt(champion.key)}
      />

      {msg && <div className="editor-msg">{msg}</div>}

      {lane && (
        <>
          <div className="page-tabs">
            {[0, 1, 2].map((i) => (
              <button key={i}
                className={`page-tab ${tab === i ? "active" : ""} ${hasData(pages[i]) ? "has-data" : ""}`}
                onClick={() => setTab(i)}>
                {pages[i].name || `Page ${i + 1}`}
                {hasData(pages[i]) && <span className="tab-dot" />}
              </button>
            ))}
          </div>
          <div className="page-name-bar">
            <input className="page-name-in" type="text"
              placeholder={`Page name (e.g. ${champion.name} ${lane.toUpperCase()} Tank)`}
              value={cur.name ?? ""}
              onChange={(e) => updatePage(tab, { ...cur, name: e.target.value })}
              maxLength={30} />
          </div>
          <RuneTreeSelector runeStyles={runeStyles} runeIconUrl={runeIconUrl}
            value={cur} onChange={(p) => updatePage(tab, p)} />
          <RuneSharePanel
            currentPage={cur}
            onImport={(p) => updatePage(tab, { ...cur, ...p })}
          />
        </>
      )}
    </div>
  );
}
