import { useState, useEffect } from "react";
import { useDataDragon } from "./hooks/useDataDragon";
import { getAllChampionRunes, useLcuStatus } from "./hooks/useLcu";
import { ChampionSelect } from "./components/ChampionSelect";
import { RuneEditor } from "./components/RuneEditor";
import { StatusBar } from "./components/StatusBar";
import { ChampSelectPanel } from "./components/ChampSelectPanel";
import type { Champion } from "./hooks/useDataDragon";
import type { ChampionRunes } from "./types";

type Tab = "editor" | "live";

export default function App() {
  const { runeStyles, champions, loading, error, getChampionById, champIconUrl, runeIconUrl } =
    useDataDragon();
  const lcu = useLcuStatus();
  const [champ, setChamp] = useState<Champion | null>(null);
  const [saved, setSaved] = useState<ChampionRunes[]>([]);
  const [tab, setTab] = useState<Tab>("editor");

  const refresh = () => getAllChampionRunes().then(setSaved).catch(() => {});
  useEffect(() => { refresh(); }, []);

  if (loading) return <div className="splash"><div className="spinner" /><p>Loading...</p></div>;
  if (error)   return <div className="splash"><p>Error: {error}</p></div>;

  return (
    <div className="app">
      <StatusBar getChampionById={getChampionById} />
      <div className="app-body">

        {/* サイドバー */}
        <aside className="sidebar">
          <div className="sidebar-hdr">
            <h1>PerkFlow</h1>
            <span>Champion Rune Manager</span>
          </div>

          {/* タブ切り替え */}
          <div className="nav-tabs">
            <button
              className={`nav-tab ${tab === "editor" ? "active" : ""}`}
              onClick={() => setTab("editor")}
            >
              Editor
            </button>
            <button
              className={`nav-tab ${tab === "live" ? "active" : ""}`}
              onClick={() => setTab("live")}
            >
              Live
            </button>
          </div>

          {/* エディタータブのみキャラリスト表示 */}
          {tab === "editor" && (
            <ChampionSelect
              champions={champions}
              savedRunes={saved}
              champIconUrl={champIconUrl}
              selected={champ}
              onSelect={setChamp}
            />
          )}
        </aside>

        {/* メインエリア */}
        <main className="main">
          {tab === "editor" ? (
            <RuneEditor
              champion={champ}
              runeStyles={runeStyles}
              runeIconUrl={runeIconUrl}
              champIconUrl={champIconUrl}
              onSaved={refresh}
            />
          ) : (
            <ChampSelectPanel
              getChampionById={getChampionById}
              champIconUrl={champIconUrl}
              lcuConnected={lcu.connected}
            />
          )}
        </main>
      </div>
    </div>
  );
}