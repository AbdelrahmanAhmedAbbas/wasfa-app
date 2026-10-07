import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { api } from "@/convex/_generated/api";
import { subscribeToFinishedImports } from "@/lib/notifications/importEvents";

/**
 * What is left of the day's imports, while `active` (a screen in focus, a sheet open).
 * The server counts up to a moment the app gives it, so the count is taken again
 * whenever it may have changed: `active` turning on, an import finishing, the app
 * coming back to the front, and the moment the next import opens up. It is only a
 * note: the server decides when a link is sent, so nothing here blocks one.
 */
export function useImportAllowance(active: boolean) {
  const { isAuthenticated } = useConvexAuth();
  const [countedFrom, setCountedFrom] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      setCountedFrom(null);
      return;
    }
    const recount = () => setCountedFrom(Date.now());
    recount();
    const unsubscribe = subscribeToFinishedImports(recount);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") recount();
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [active]);

  const allowance = useQuery(
    api.imports.allowance,
    isAuthenticated && countedFrom ? { now: countedFrom } : "skip"
  );

  const resetsAt = allowance?.resets_at ?? null;
  useEffect(() => {
    if (!active || resetsAt === null) return;
    const timer = setTimeout(() => setCountedFrom(Date.now()), Math.max(0, resetsAt - Date.now()) + 1000);
    return () => clearTimeout(timer);
  }, [active, resetsAt]);

  // A recount has no answer for a moment; the last one stays up rather than blinking out.
  const [lastAllowance, setLastAllowance] = useState(allowance);
  const shown = isAuthenticated ? (allowance ?? lastAllowance) : undefined;
  if (shown !== lastAllowance) setLastAllowance(shown);
  return shown;
}
