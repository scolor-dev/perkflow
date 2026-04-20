import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { applyRunesManually, getChampionRunes } from "../hooks/useLcu";
import { useDataDragonContext } from "../contexts/DataDragonContext";
import { useLcuContext } from "../contexts/LcuContext";
import type { ChampionRunes, Lane } from "../types";
import { LANES } from "../types";

export function ChampSelectPanel() {
  const { getChampionById, champIconUrl } = useDataDragonContext();
  const { connected: lcuConnected } = useLcuContext();
  const [championId, setChampionId] = useState<number | null>(null);
  const [detectedLane, setDetectedLane] = useState<Lane | null>(null);
  const [runes, setRunes] = useState<ChampionRunes | null>(null);
  const [applying, setApplying] = useState(false);
  const [lastResult, setLastResult] = useState<"ok" | "err" | null>(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    const unlistens = Promise.all([
      listen<{ championId: number; lane?: Lane }>("champion-changed", async (e) => {
        const id = e.payload.championId;
        const lane = e.payload.lane ?? null;
        setChampionId(id);
        setDetectedLane(lane);
        setLastResult(null);
        setErrMsg("");
        // レーンあり → 完全一致で検索、なければフォールバックはバックエンドが担当
        const saved = await getChampionRunes(id, lane).catch(() => null);
        setRunes(saved);
      }),
      listen("champion-cleared", () => {
        setChampionId(null);
        setDetectedLane(null);
        setRunes(null);
        setLastResult(null);
      }),
      listen<{ lane?: Lane }>("runes-applied", () => {
        setLastResult("ok");
        setApplying(false);
      }),
      listen<{ error: string }>("runes-error", (e) => {
        setLastResult("err");
        setErrMsg(e.payload.error);
        setApplying(false);
      }),
    ]);
    return () => { unlistens.then((fns) => fns.forEach((f) => f())); };
  }, []);

  const handleApply = async () => {
    if (!championId || !runes) return;
    setApplying(true);
    setLastResult(null);
    try {
      await applyRunesManually(championId, detectedLane);
      setLastResult("ok");
    } catch (e) {
      setErrMsg(String(e));
      setLastResult("err");
    } finally {
      setApplying(false);
    }
  };

  const champion = championId ? getChampionById(championId) : null;
  const laneLabel = detectedLane
    ? LANES.find((l) => l.value === detectedLane)?.label ?? detectedLane
    : null;

  if (!lcuConnected) {
    return (
      <div className="cs-panel cs-panel-idle">
        <div className="cs-icon">⟳</div>
        <div className="cs-msg">LoL not running</div>
      </div>
    );
  }

  if (!championId) {
    return (
      <div className="cs-panel cs-panel-idle">
        <div className="cs-icon">⚔</div>
        <div className="cs-msg">Waiting for Champion Select...</div>
        <div className="cs-hint">Champion Select でキャラをホバーすると自動検知します</div>
      </div>
    );
  }

  return (
    <div className="cs-panel cs-panel-active">
      <div className="cs-champ-row">
        {champion && (
          <img className="cs-champ-icon" src={champIconUrl(champion)} alt={champion.name} />
        )}
        <div className="cs-champ-info">
          <div className="cs-champ-name">{champion?.name ?? `ID: ${championId}`}</div>
          <div className="cs-champ-sub">
            {laneLabel && <span className="cs-lane-badge">{laneLabel}</span>}
            {runes
              ? ` ${runes.pages.length} page${runes.pages.length > 1 ? "s" : ""} registered`
              : " No runes registered"}
          </div>
        </div>
        {lastResult === "ok" && (
          <div className="cs-auto-badge ok">✓ Auto-applied</div>
        )}
        {lastResult === "err" && (
          <div className="cs-auto-badge err">✗ Failed</div>
        )}
      </div>

      {runes && (
        <div className="cs-pages">
          {runes.pages.map((p, i) => (
            <div key={i} className="cs-page-chip">
              {p.name || `Page ${i + 1}`}
            </div>
          ))}
        </div>
      )}

      {runes ? (
        <button
          className={`cs-apply-btn ${lastResult === "ok" ? "ok" : lastResult === "err" ? "err" : ""}`}
          onClick={handleApply}
          disabled={applying}
        >
          {applying
            ? "Applying..."
            : lastResult === "ok"
            ? "✓ Applied! (Click to re-apply)"
            : lastResult === "err"
            ? "✗ Failed — Retry"
            : "Apply Runes Now"}
        </button>
      ) : (
        <div className="cs-no-runes">
          {laneLabel
            ? `${champion?.name ?? ""} (${laneLabel}) のルーンが未登録です。`
            : `このチャンピオンのルーンが未登録です。`}
          <br />
          Editorタブで登録してください。
        </div>
      )}

      {lastResult === "err" && errMsg && (
        <div className="cs-err-msg">{errMsg}</div>
      )}
    </div>
  );
}
