import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: string; title: string; message?: string; tone?: "neutral" | "success" | "warning" | "danger" };

const Ctx = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    const toast: Toast = { id, ...t };
    setItems((x) => [toast, ...x].slice(0, 3));
    window.setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          display: "grid",
          gap: 10,
          zIndex: 9999,
          width: "min(420px, calc(100vw - 32px))",
        }}
      >
        {items.map((t) => {
          const tone =
            t.tone === "success"
              ? { border: "rgba(16,185,129,0.35)", bg: "rgba(16,185,129,0.10)" }
              : t.tone === "warning"
              ? { border: "rgba(245,158,11,0.35)", bg: "rgba(245,158,11,0.10)" }
              : t.tone === "danger"
              ? { border: "rgba(239,68,68,0.35)", bg: "rgba(239,68,68,0.10)" }
              : { border: "var(--border)", bg: "rgba(255,255,255,0.85)" };

          return (
            <div
              key={t.id}
              style={{
                background: tone.bg,
                backdropFilter: "blur(12px)",
                border: `1px solid ${tone.border}`,
                boxShadow: "var(--shadow2)",
                borderRadius: 16,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13 }}>{t.title}</div>
              {t.message ? <div style={{ marginTop: 6, fontSize: 12, color: "rgba(15,23,42,0.72)" }}>{t.message}</div> : null}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
}
