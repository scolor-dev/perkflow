import type { Lane, ChampionRunes } from "../types";
import { LANES } from "../types";

interface LaneSelectProps {
  selected: Lane | null;
  onChange: (lane: Lane) => void;
  savedRunes?: ChampionRunes[];
  championId?: number;
}

export function LaneSelect({ selected, onChange, savedRunes, championId }: LaneSelectProps) {
  const savedLanes = new Set(
    savedRunes
      ?.filter((r) => r.championId === championId && r.lane != null)
      .map((r) => r.lane as Lane) ?? []
  );

  return (
    <div className="lane-select">
      {LANES.map(({ value, label }) => (
        <button
          key={value}
          className={`lane-btn ${selected === value ? "active" : ""} ${savedLanes.has(value) ? "saved" : ""}`}
          onClick={() => onChange(value)}
          title={label}
        >
          <span className="lane-icon">{getLaneIcon(value)}</span>
          <span className="lane-label">{label}</span>
          {savedLanes.has(value) && <span className="lane-saved-dot" />}
        </button>
      ))}
    </div>
  );
}

function getLaneIcon(lane: Lane): string {
  switch (lane) {
    case "top": return "⬆";
    case "jungle": return "✦";
    case "mid": return "◆";
    case "bot": return "⬇";
    case "support": return "♡";
  }
}
