"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "success" | "error" };
const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    // Errors stay longer: people need time to read what went wrong.
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} className={cn("pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg", t.tone === "success" ? "bg-ink" : "bg-site-red")}>
            {t.tone === "success" ? <CheckCircle2 className="h-4 w-4 text-safety-400" /> : <AlertTriangle className="h-4 w-4" />}
            <span className="flex-1">{t.message}</span>
            <button aria-label="Dismiss" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Fire a toast whenever a server action returns a new message/error. */
export function useActionToast(state: { ok?: boolean; message?: string; error?: string } | undefined) {
  const toast = useToast();
  useEffect(() => {
    if (!state) return;
    if (state.ok && state.message) toast(state.message);
    else if (state.ok === false && state.error && !("fieldErrors" in state && state.fieldErrors)) toast(state.error, "error");
  }, [state, toast]);
}
