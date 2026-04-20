import { useState, useMemo } from "react";
import { useDataDragonContext } from "../contexts/DataDragonContext";
import { useChampionContext } from "../contexts/ChampionContext";
import type { Champion } from "../hooks/useDataDragon";

export function ChampionSelect() {
  const { champions, champIconUrl } = useDataDragonContext();
  const { savedRunes, selectedChampion, setSelectedChampion } = useChampionContext();
  const [search, setSearch] = useState("");

  // チャンピオンIDごとの登録レーン数
  const savedLaneCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const r of savedRunes) {
      counts.set(r.championId, (counts.get(r.championId) ?? 0) + 1);
    }
    return counts;
  }, [savedRunes]);

  const filtered = useMemo(
    () => champions.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase())
    ),
    [champions, search]
  );

  const savedChamps = !search ? champions.filter((c) => savedLaneCounts.has(parseInt(c.key))) : [];
  const restChamps = filtered.filter((c) => search || !savedLaneCounts.has(parseInt(c.key)));

  return (
    <div className="champ-select">
      <div className="champ-search">
        <input type="text" placeholder="Search..." value={search}
          onChange={(e) => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch("")}>x</button>}
      </div>
      {savedChamps.length > 0 && (
        <>
          <div className="section-label">Saved</div>
          <div className="champ-grid">
            {savedChamps.map((c) => (
              <ChampCard key={c.key} champ={c} url={champIconUrl(c)}
                selected={selectedChampion?.key === c.key}
                laneCount={savedLaneCounts.get(parseInt(c.key)) ?? 0}
                onClick={() => setSelectedChampion(c)} />
            ))}
          </div>
          <div className="section-label">All Champions</div>
        </>
      )}
      <div className="champ-grid">
        {restChamps.map((c) => (
          <ChampCard key={c.key} champ={c} url={champIconUrl(c)}
            selected={selectedChampion?.key === c.key}
            laneCount={savedLaneCounts.get(parseInt(c.key)) ?? 0}
            onClick={() => setSelectedChampion(c)} />
        ))}
      </div>
      {filtered.length === 0 && <p className="no-results">Not found</p>}
    </div>
  );
}

function ChampCard({ champ, url, selected, laneCount, onClick }: {
  champ: Champion; url: string; selected: boolean; laneCount: number; onClick: () => void;
}) {
  return (
    <button className={`champ-card ${selected ? "selected" : ""}`} onClick={onClick} title={champ.name}>
      <img src={url} alt={champ.name} />
      {laneCount > 0 && (
        <span className="saved-badge" title={`${laneCount} lane${laneCount > 1 ? "s" : ""} registered`}>
          {laneCount}
        </span>
      )}
      <span className="champ-name">{champ.name}</span>
    </button>
  );
}
