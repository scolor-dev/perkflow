import { createContext, useContext, type ReactNode } from "react";
import { useLcuStatus } from "../hooks/useLcu";
import type { LcuStatus } from "../types";

const LcuContext = createContext<LcuStatus>({ connected: false });

export function LcuProvider({ children }: { children: ReactNode }) {
  const status = useLcuStatus();
  return <LcuContext.Provider value={status}>{children}</LcuContext.Provider>;
}

export function useLcuContext() {
  return useContext(LcuContext);
}
