import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export default function Input({ label, hint, style, ...props }: Props) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      {label ? <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{label}</span> : null}
      <input
        {...props}
        style={{
          height: 42,
          padding: "0 14px",
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "#fff",
          outline: "none",
          boxShadow: "var(--shadow2)",
          ...style,
        }}
      />
      {hint ? <span style={{ fontSize: 12, color: "var(--muted)" }}>{hint}</span> : null}
    </label>
  );
}
