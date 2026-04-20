import { useState, useCallback, useRef } from "react";
import { useChampionSelectWatcher } from "../hooks/useLcu";
import { useDataDragonContext } from "../contexts/DataDragonContext";
import { useLcuContext } from "../contexts/LcuContext";

interface Toast { id: number; type: "ok"|"err"|"info"; msg: string }

export function StatusBar() {
  const lcu = useLcuContext();
  const { getChampionById } = useDataDragonContext();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const uid = useRef(0);

  const push = (type: Toast["type"], msg: string) => {
    const id = uid.current++;
    setToasts((p) => [...p, { id, type, msg }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  };

  useChampionSelectWatcher(
    useCallback((id) => {
      const c = getChampionById(id);
      push("info", `Detected: ${c?.name ?? `ID:${id}`} - applying runes...`);
    }, [getChampionById]),
    useCallback((i) => push("ok", `Applied ${i.pageCount} pages for ${i.championName}`), []),
    useCallback((e) => push("err", `Error: ${e}`), [])
  );

  return (
    <>
      <div className="status-bar">
        <span className={`lcu-dot ${lcu.connected ? "on" : "off"}`} />
        <span className={`lcu-label ${lcu.connected ? "on" : ""}`}>
          {lcu.connected ? `LoL Connected :${lcu.port}` : "LoL not running - waiting..."}
        </span>
        <span className="status-hint">
          {lcu.connected
            ? "Runes auto-apply when you pick a champion in Champ Select"
            : "Start League of Legends to connect"}
        </span>
      </div>
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </>
  );
}
