import React from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
};

export default function Card({ inset, style, ...props }: Props) {
  return (
    <div
      {...props}
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: inset ? "none" : "var(--shadow)",
        ...style,
      }}
    />
  );
}
