// src/lib/tenant.ts
const KEY = "last_tenant_slug";

export function setLastTenantSlug(slug: string) {
  const s = String(slug || "").trim();
  if (s) localStorage.setItem(KEY, s);
}

export function getLastTenantSlug(): string {
  return (localStorage.getItem(KEY) || "").trim();
}

export function resolveTenantSlug(explicit?: string | null): string {
  const a = String(explicit || "").trim();
  if (a) return a;

  const b = getLastTenantSlug();
  if (b) return b;

  // Optional: set DEFAULT_TENANT_SLUG in .env for dev convenience
  const c = (process.env.REACT_APP_DEFAULT_TENANT_SLUG || "").trim();
  if (c) return c;

  return "";
}
