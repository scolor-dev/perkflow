import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LcuStatus, ChampionRunes, LcuRunePage, Lane } from "../types";

export function useLcuStatus() {
  const [status, setStatus] = useState<LcuStatus>({ connected: false });
  useEffect(() => {
    invoke<LcuStatus>("get_lcu_status").then(setStatus).catch(() => {});
    const unlisten = listen<LcuStatus>("lcu-status", (e) => setStatus(e.payload));
    const interval = setInterval(() => {
      invoke<LcuStatus>("get_lcu_status").then(setStatus).catch(() => {});
    }, 5000);
    return () => { unlisten.then((f) => f()); clearInterval(interval); };
  }, []);
  return status;
}

export function useChampionSelectWatcher(
  onChampionChanged: (id: number, lane: Lane | null) => void,
  onRunesApplied: (info: { championId: number; championName: string; lane?: Lane; pageCount: number }) => void,
  onRunesError: (err: string) => void
) {
  useEffect(() => {
    const uns = Promise.all([
      listen<{ championId: number; lane?: Lane }>("champion-changed", (e) =>
        onChampionChanged(e.payload.championId, e.payload.lane ?? null)),
      listen<{ championId: number; championName: string; lane?: Lane; pageCount: number }>("runes-applied", (e) =>
        onRunesApplied(e.payload)),
      listen<{ error: string }>("runes-error", (e) => onRunesError(e.payload.error)),
    ]);
    return () => { uns.then((fns) => fns.forEach((f) => f())); };
  }, [onChampionChanged, onRunesApplied, onRunesError]);
}

export const saveChampionRunes = (runes: ChampionRunes) =>
  invoke<void>("save_champion_runes", { championRunes: runes });

export const getChampionRunes = (championId: number, lane?: Lane | null) =>
  invoke<ChampionRunes | null>("get_champion_runes", { championId, lane: lane ?? null });

export const getAllChampionRunes = () =>
  invoke<ChampionRunes[]>("get_all_champion_runes");

export const deleteChampionRunes = (championId: number, lane?: Lane | null) =>
  invoke<void>("delete_champion_runes", { championId, lane: lane ?? null });

export const applyRunesManually = (championId: number, lane?: Lane | null) =>
  invoke<void>("apply_runes_manually", { championId, lane: lane ?? null });

export const getCurrentRunePages = () =>
  invoke<LcuRunePage[]>("get_current_rune_pages");
