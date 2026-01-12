import React from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "primary";

const toneStyle: Record<Tone, React.CSSProperties> = {
  neutral: { background: "var(--chip)", color: "rgba(15,23,42,0.82)" },
  success: { background: "rgba(16,185,129,0.14)", color: "rgba(6,95,70,0.95)" },
  warning: { background: "rgba(245,158,11,0.18)", color: "rgba(146,64,14,0.95)" },
  danger: { background: "rgba(239,68,68,0.16)", color: "rgba(153,27,27,0.95)" },
  primary: { background: "rgba(79,70,229,0.14)", color: "rgba(67,56,202,0.98)" },
};

export default function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
        ...toneStyle[tone],
      }}
    >
      {children}
    </span>
  );
}
