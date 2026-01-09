// appsail/src/lib/normalize.ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  const t = phone.trim();
  const plus = t.startsWith("+") ? "+" : "";
  const digits = t.replace(/[^\d]/g, "");
  return plus + digits;
}

export function maskContact(channel: "sms" | "email", value: string): string {
  if (channel === "email") {
    const [u, d] = value.split("@");
    if (!d) return "***";
    return `${(u ?? "").slice(0, 2)}***@${d}`;
  }
  const p = value.replace(/[^\d]/g, "");
  return p.length < 4 ? "***" : `***${p.slice(-4)}`;
}
