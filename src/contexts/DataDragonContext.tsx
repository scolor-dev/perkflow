import { createContext, useContext, type ReactNode } from "react";
import { useDataDragon, type Champion } from "../hooks/useDataDragon";
import type { PerkStyle } from "../types";

interface DataDragonContextValue {
  runeStyles: PerkStyle[];
  champions: Champion[];
  loading: boolean;
  error: string | null;
  getChampionById: (id: number) => Champion | undefined;
  champIconUrl: (c: Champion) => string;
  runeIconUrl: (icon: string) => string;
}

const DataDragonContext = createContext<DataDragonContextValue | null>(null);

export function DataDragonProvider({ children }: { children: ReactNode }) {
  const value = useDataDragon();
  return <DataDragonContext.Provider value={value}>{children}</DataDragonContext.Provider>;
}

export function useDataDragonContext() {
  const ctx = useContext(DataDragonContext);
  if (!ctx) throw new Error("useDataDragonContext must be used within DataDragonProvider");
  return ctx;
}
