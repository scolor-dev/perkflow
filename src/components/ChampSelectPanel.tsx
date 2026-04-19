import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { applyRunesManually, getChampionRunes } from "../hooks/useLcu";
import type { Champion } from "../hooks/useDataDragon";
import type { ChampionRunes } from "../types";

interface Props {
  getChampionById: (id: number) => Champion | undefined;
  champIconUrl: (c: Champion) => string;
  lcuConnected: boolean;
}

export function ChampSelectPanel({ getChampionById, champIconUrl, lcuConnected }: Props) {
  const [championId, setChampionId] = useState<number | null>(null);
  const [runes, setRunes] = useState<ChampionRunes | null>(null);
  const [applying, setApplying] = useState(false);
  const [lastResult, setLastResult] = useState<"ok" | "err" | null>(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    const unlistens = Promise.all([
      // ホバー/選択でキャラが変わるたびに発火
      listen<{ championId: number }>("champion-changed", async (e) => {
        const id = e.payload.championId;
        setChampionId(id);
        setLastResult(null);
        setErrMsg("");

        const saved = await getChampionRunes(id).catch(() => null);
        setRunes(saved);
      }),

      // キャラ未選択に戻った
      listen("champion-cleared", () => {
        setChampionId(null);
        setRunes(null);
        setLastResult(null);
      }),

      // 自動適用成功
      listen("runes-applied", () => {
        setLastResult("ok");
        setApplying(false);
      }),

      // 自動適用失敗
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
      await applyRunesManually(championId);
      setLastResult("ok");
    } catch (e) {
      setErrMsg(String(e));
      setLastResult("err");
    } finally {
      setApplying(false);
    }
  };

  const champion = championId ? getChampionById(championId) : null;

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
            {runes
              ? `${runes.pages.length} page${runes.pages.length > 1 ? "s" : ""} registered`
              : "No runes registered"}
          </div>
        </div>
        {/* 自動適用ステータス */}
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
          このチャンピオンのルーンが未登録です。<br />
          Editorタブで登録してください。
        </div>
      )}

      {lastResult === "err" && errMsg && (
        <div className="cs-err-msg">{errMsg}</div>
      )}
    </div>
  );
}