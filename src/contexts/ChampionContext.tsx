import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Champion } from "../hooks/useDataDragon";
import type { ChampionRunes, Lane } from "../types";
import { getAllChampionRunes } from "../hooks/useLcu";

interface ChampionContextValue {
  selectedChampion: Champion | null;
  setSelectedChampion: (c: Champion | null) => void;
  selectedLane: Lane | null;
  setSelectedLane: (lane: Lane | null) => void;
  savedRunes: ChampionRunes[];
  refreshSaved: () => void;
}

const ChampionContext = createContext<ChampionContextValue | null>(null);

export function ChampionProvider({ children }: { children: ReactNode }) {
  const [selectedChampion, setSelectedChampionRaw] = useState<Champion | null>(null);
  const [selectedLane, setSelectedLane] = useState<Lane | null>(null);
  const [savedRunes, setSavedRunes] = useState<ChampionRunes[]>([]);

  const setSelectedChampion = useCallback((c: Champion | null) => {
    setSelectedChampionRaw(c);
    setSelectedLane(null);
  }, []);

  const refreshSaved = useCallback(
    () => getAllChampionRunes().then(setSavedRunes).catch(() => {}),
    []
  );

  useEffect(() => { refreshSaved(); }, []);

  return (
    <ChampionContext.Provider value={{
      selectedChampion, setSelectedChampion,
      selectedLane, setSelectedLane,
      savedRunes, refreshSaved,
    }}>
      {children}
    </ChampionContext.Provider>
  );
}

export function useChampionContext() {
  const ctx = useContext(ChampionContext);
  if (!ctx) throw new Error("useChampionContext must be used within ChampionProvider");
  return ctx;
}
