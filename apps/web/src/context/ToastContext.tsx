import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "../icons";

type Toast = { id: number; message: string; tone: "default" | "success" | "error"; description?: string };

type ToastContextValue = {
  push: (message: string, tone?: Toast["tone"], description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TITLE_TONE_CLASS: Record<Toast["tone"], string> = {
  default: "text-text",
  success: "text-green",
  error: "text-red",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timeoutsRef = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout != null) window.clearTimeout(timeout);
    timeoutsRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: string, tone: Toast["tone"] = "default", description?: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, tone, description }]);
    const timeout = window.setTimeout(() => {
      timeoutsRef.current.delete(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
    timeoutsRef.current.set(id, timeout);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-[320px] items-start gap-3 rounded-2xl border border-border-soft bg-panel-2 p-4 shadow-2xl"
          >
            <div className="min-w-0 flex-1">
              <p className={`text-[14px] font-semibold ${TITLE_TONE_CLASS[t.tone]}`}>{t.message}</p>
              {t.description && <p className="mt-1 text-[13px] leading-snug text-text-muted">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
