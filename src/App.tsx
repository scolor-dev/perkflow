import { useState } from "react";
import { DataDragonProvider, useDataDragonContext } from "./contexts/DataDragonContext";
import { LcuProvider } from "./contexts/LcuContext";
import { ChampionProvider } from "./contexts/ChampionContext";
import { ChampionSelect } from "./components/ChampionSelect";
import { RuneEditor } from "./components/RuneEditor";
import { StatusBar } from "./components/StatusBar";
import { ChampSelectPanel } from "./components/ChampSelectPanel";

type Tab = "editor" | "live";

function AppContent() {
  const { loading, error } = useDataDragonContext();
  const [tab, setTab] = useState<Tab>("editor");

  if (loading) return <div className="splash"><div className="spinner" /><p>Loading...</p></div>;
  if (error)   return <div className="splash"><p>Error: {error}</p></div>;

  return (
    <div className="app">
      <StatusBar />
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-hdr">
            <h1>PerkFlow</h1>
            <span>Champion Rune Manager</span>
          </div>
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
          {tab === "editor" && <ChampionSelect />}
        </aside>
        <main className="main">
          {tab === "editor" ? <RuneEditor /> : <ChampSelectPanel />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DataDragonProvider>
      <LcuProvider>
        <ChampionProvider>
          <AppContent />
        </ChampionProvider>
      </LcuProvider>
    </DataDragonProvider>
  );
}
