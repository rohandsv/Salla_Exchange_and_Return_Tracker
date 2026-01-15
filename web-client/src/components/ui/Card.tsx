import React from "react";
export default function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card ${className}`}>{children}</div>;
}
