import React from "react";

export default function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warn" | "success" | "info";
  children: React.ReactNode;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
