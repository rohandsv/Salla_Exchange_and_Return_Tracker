import React, { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

export default function Toast({
  open,
  type = "info",
  message,
  onClose,
  durationMs = 2600,
}: {
  open: boolean;
  type?: ToastType;
  message: string;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, onClose, durationMs]);

  if (!open) return null;
  return (
    <div className={`toast ${type}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
