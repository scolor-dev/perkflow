import { useState, useMemo } from "react";
import type { Champion } from "../hooks/useDataDragon";
import type { ChampionRunes } from "../types";

interface Props {
  champions: Champion[];
  savedRunes: ChampionRunes[];
  champIconUrl: (c: Champion) => string;
  selected: Champion | null;
  onSelect: (c: Champion) => void;
}

export function ChampionSelect({ champions, savedRunes, champIconUrl, selected, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const savedIds = useMemo(() => new Set(savedRunes.map((r) => r.championId)), [savedRunes]);

  const filtered = useMemo(
    () => champions.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase())
    ),
    [champions, search]
  );

  const savedChamps = !search ? champions.filter((c) => savedIds.has(parseInt(c.key))) : [];
  const restChamps = filtered.filter((c) => search || !savedIds.has(parseInt(c.key)));

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
                selected={selected?.key === c.key} saved onClick={() => onSelect(c)} />
            ))}
          </div>
          <div className="section-label">All Champions</div>
        </>
      )}
      <div className="champ-grid">
        {restChamps.map((c) => (
          <ChampCard key={c.key} champ={c} url={champIconUrl(c)}
            selected={selected?.key === c.key} saved={savedIds.has(parseInt(c.key))}
            onClick={() => onSelect(c)} />
        ))}
      </div>
      {filtered.length === 0 && <p className="no-results">Not found</p>}
    </div>
  );
}

function ChampCard({ champ, url, selected, saved, onClick }: {
  champ: Champion; url: string; selected: boolean; saved: boolean; onClick: () => void;
}) {
  return (
    <button className={`champ-card ${selected ? "selected" : ""}`} onClick={onClick} title={champ.name}>
      <img src={url} alt={champ.name} />
      {saved && <span className="saved-badge">v</span>}
      <span className="champ-name">{champ.name}</span>
    </button>
  );
}
