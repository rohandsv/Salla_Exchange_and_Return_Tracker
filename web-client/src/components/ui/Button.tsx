import React from "react";

type Variant = "primary" | "ghost" | "soft" | "outline";
type Size = "sm" | "md";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const styles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(135deg, var(--primary), var(--primary2))",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 16px 30px rgba(79, 70, 229, 0.18)",
  },
  soft: {
    background: "var(--primarySoft)",
    color: "var(--primary)",
    border: "1px solid rgba(79, 70, 229, 0.20)",
  },
  outline: {
    background: "#fff",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text)",
    border: "1px solid transparent",
  },
};

const sizes: Record<Size, React.CSSProperties> = {
  sm: { height: 34, padding: "0 12px", borderRadius: 12, fontSize: 13 },
  md: { height: 40, padding: "0 14px", borderRadius: 14, fontSize: 14 },
};

export default function Button({ variant = "outline", size = "md", style, ...props }: Props) {
  return (
    <button
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.55 : 1,
        transition: "transform 120ms ease, box-shadow 120ms ease",
        userSelect: "none",
        ...sizes[size],
        ...styles[variant],
        ...style,
      }}
      onMouseDown={(e) => {
        if (props.disabled) return;
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)";
        props.onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0px)";
        props.onMouseUp?.(e);
      }}
    />
  );
}
