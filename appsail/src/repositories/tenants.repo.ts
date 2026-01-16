// appsail/src/repositories/tenants.repo.ts
import { getCatalystApp } from "../lib/catalyst";

function assertRowIdDigits(id: string | number) {
  const v = String(id ?? "").trim();
  if (!/^\d+$/.test(v)) throw new Error("ROWID/FK must be digits");
  return v;
}

export type TenantRow = {
  ROWID: string;

  salla_store_id: string;
  store_name: string;
  store_domain?: string | null;
  timezone?: string | null;

  plan_code: string;
  flags_json?: string | null;

  status: string;

  portal_public_slug: string;
};

const ALLOWED_SALLA_UPDATE_COLUMNS = new Set(["salla_store_id", "store_name", "store_domain", "status"]);

function pickAllowedSallaFields(patch: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (ALLOWED_SALLA_UPDATE_COLUMNS.has(k)) out[k] = v;
  }
  return out;
}

function normalizeSlug(slug: string) {
  return String(slug ?? "").trim().toLowerCase();
}

function makePendingStoreId(portal_public_slug: string) {
  const slug = String(portal_public_slug ?? "").trim() || "unknown";
  const v = `pending-${slug}-${Date.now()}`;
  return v.length > 120 ? v.slice(0, 120) : v;
}

function safeJsonParse(input: any): any {
  if (input == null) return null;
  if (typeof input === "object") return input;
  const s = String(input ?? "").trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function safeJsonStringify(input: any): string | null {
  if (input == null) return null;
  try {
    return JSON.stringify(input);
  } catch {
    return null;
  }
}

/**
 * Deep merge (plain objects only)
 */
function deepMerge(target: any, patch: any): any {
  if (!patch || typeof patch !== "object") return target;
  const out = Array.isArray(target) ? [...target] : { ...(target ?? {}) };

  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}

export class TenantsRepo {
  static tableName = "tenants";

  private static cache = new Map<string, { row: TenantRow; exp: number }>();
  private static CACHE_TTL_MS = 5 * 60 * 1000;

  private static normalizeRow(match: any): TenantRow {
    return {
      ROWID: String(match.ROWID),

      salla_store_id: String(match.salla_store_id ?? ""),
      store_name: String(match.store_name ?? ""),
      store_domain: match.store_domain ?? null,
      timezone: match.timezone ?? null,

      plan_code: String(match.plan_code ?? ""),
      flags_json: match.flags_json ?? null,

      status: String(match.status ?? ""),
      portal_public_slug: String(match.portal_public_slug ?? ""),
    };
  }

  private static updateCacheByTenantId(tenantId: string, patch: Partial<TenantRow>) {
    for (const [slugKey, cached] of this.cache.entries()) {
      if (cached.row.ROWID === tenantId && cached.exp > Date.now()) {
        this.cache.set(slugKey, { row: { ...cached.row, ...patch }, exp: Date.now() + this.CACHE_TTL_MS });
      }
    }
  }

  static async findByPortalSlug(req: any, slug: string): Promise<TenantRow | null> {
    const key = normalizeSlug(slug);

    const cached = this.cache.get(key);
    if (cached && cached.exp > Date.now()) return cached.row;

    const app = getCatalystApp(req);
    const table = app.datastore().table(this.tableName);

    let nextToken: string | undefined = undefined;
    let more = true;
    let loops = 0;

    while (more) {
      const resp = await table.getPagedRows({ nextToken, maxRows: 200 });
      const rows: any[] = resp?.data ?? [];

      const match = rows.find((r) => normalizeSlug(String(r.portal_public_slug ?? "")) === key);

      if (match) {
        const row = this.normalizeRow(match);
        this.cache.set(key, { row, exp: Date.now() + this.CACHE_TTL_MS });
        return row;
      }

      more = Boolean(resp?.more_records);
      nextToken = resp?.next_token;

      loops++;
      if (loops > 50) break;
    }

    return null;
  }

  static async findBySallaStoreId(req: any, sallaStoreId: string | number): Promise<TenantRow | null> {
    const target = String(sallaStoreId ?? "").trim();
    if (!target) return null;

    const app = getCatalystApp(req);
    const table = app.datastore().table(this.tableName);

    let nextToken: string | undefined = undefined;
    let more = true;
    let loops = 0;

    while (more) {
      const resp = await table.getPagedRows({ nextToken, maxRows: 200 });
      const rows: any[] = resp?.data ?? [];

      const match = rows.find((r) => String(r.salla_store_id ?? "").trim() === target);
      if (match) return this.normalizeRow(match);

      more = Boolean(resp?.more_records);
      nextToken = resp?.next_token;

      loops++;
      if (loops > 50) break;
    }

    return null;
  }

  static async updateSallaConnectionFields(
    req: any,
    tenantId: string | number,
    patch: Partial<Pick<TenantRow, "salla_store_id" | "store_name" | "store_domain" | "status">>
  ): Promise<void> {
    const app = getCatalystApp(req);
    const table = app.datastore().table(this.tableName);

    const tid = assertRowIdDigits(tenantId);

    const payload = pickAllowedSallaFields(patch as any);
    if ("store_domain" in payload && payload.store_domain === undefined) delete payload.store_domain;

    await table.updateRow({ ROWID: tid, ...payload });
    this.updateCacheByTenantId(tid, payload as any);
  }

  static async create(req: any, args: { portal_public_slug: string; status?: string; plan_code?: string }): Promise<any> {
    const slug = String(args.portal_public_slug ?? "").trim();
    if (!slug) throw new Error("portal_public_slug is required");

    const app = getCatalystApp(req);
    const table = app.datastore().table(this.tableName);

    return table.insertRow({
      portal_public_slug: slug,

      status: args.status ?? "draft",
      plan_code: args.plan_code ?? "free",

      // mandatory + unique placeholder (authorize overwrites)
      salla_store_id: makePendingStoreId(slug),

      store_name: "",
      store_domain: null,
      timezone: null,
      flags_json: null,
    });
  }

  /**
   * ✅ NEW: ensure tenant exists for portal_public_slug.
   * Used by webhooks to avoid 404 when install arrives before merchant creates tenant.
   */
  static async ensureTenantByPortalSlug(
    req: any,
    portal_public_slug: string,
    defaults?: { status?: string; plan_code?: string }
  ): Promise<TenantRow> {
    const slug = String(portal_public_slug ?? "").trim();
    if (!slug) throw new Error("portal_public_slug is required");

    const existing = await this.findByPortalSlug(req, slug);
    if (existing) return existing;

    await this.create(req, { portal_public_slug: slug, status: defaults?.status ?? "draft", plan_code: defaults?.plan_code ?? "free" });

    const after = await this.findByPortalSlug(req, slug);
    if (!after) throw new Error("Tenant created but could not be loaded");
    return after;
  }

  static async getFlagsObject(req: any, tenantId: string | number): Promise<Record<string, any>> {
    const app = getCatalystApp(req);
    const table = app.datastore().table(this.tableName);

    const tid = assertRowIdDigits(tenantId);

    const row = await table.getRow(tid as any);
    const flags = safeJsonParse((row as any)?.flags_json);
    return flags && typeof flags === "object" && !Array.isArray(flags) ? flags : {};
  }

  static async mergeFlagsObject(req: any, tenantId: string | number, patch: Record<string, any>) {
    const app = getCatalystApp(req);
    const table = app.datastore().table(this.tableName);

    const tid = assertRowIdDigits(tenantId);

    const current = await this.getFlagsObject(req, tid);
    const merged = deepMerge(current, patch);

    const mergedStr = safeJsonStringify(merged);
    await table.updateRow({ ROWID: tid, flags_json: mergedStr });

    this.updateCacheByTenantId(tid, { flags_json: mergedStr } as any);
    return merged;
  }
}
