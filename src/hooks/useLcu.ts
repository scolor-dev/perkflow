import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LcuStatus, ChampionRunes, LcuRunePage } from "../types";

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
  onChampionChanged: (id: number) => void,
  onRunesApplied: (info: { championId: number; championName: string; pageCount: number }) => void,
  onRunesError: (err: string) => void
) {
  useEffect(() => {
    const uns = Promise.all([
      listen<{ championId: number }>("champion-changed", (e) => onChampionChanged(e.payload.championId)),
      listen<{ championId: number; championName: string; pageCount: number }>("runes-applied", (e) => onRunesApplied(e.payload)),
      listen<{ error: string }>("runes-error", (e) => onRunesError(e.payload.error)),
    ]);
    return () => { uns.then((fns) => fns.forEach((f) => f())); };
  }, [onChampionChanged, onRunesApplied, onRunesError]);
}

export const saveChampionRunes = (runes: ChampionRunes) =>
  invoke<void>("save_champion_runes", { championRunes: runes });

export const getChampionRunes = (championId: number) =>
  invoke<ChampionRunes | null>("get_champion_runes", { championId });

export const getAllChampionRunes = () =>
  invoke<ChampionRunes[]>("get_all_champion_runes");

export const deleteChampionRunes = (championId: number) =>
  invoke<void>("delete_champion_runes", { championId });

export const applyRunesManually = (championId: number) =>
  invoke<void>("apply_runes_manually", { championId });

export const getCurrentRunePages = () =>
  invoke<LcuRunePage[]>("get_current_rune_pages");
