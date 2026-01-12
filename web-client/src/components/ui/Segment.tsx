import React from "react";

export default function Segment({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "rgba(15,23,42,0.05)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid transparent",
              background: active ? "#fff" : "transparent",
              boxShadow: active ? "var(--shadow2)" : "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              color: active ? "var(--text)" : "rgba(15,23,42,0.65)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
