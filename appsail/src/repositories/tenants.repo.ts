// appsail/src/repositories/tenants.repo.ts
import { getCatalystApp } from "../lib/catalyst";

function assertRowIdDigits(id: string | number) {
  const v = String(id ?? "").trim();
  if (!/^\d+$/.test(v)) throw new Error("ROWID/FK must be digits");
  return v;
}

export type TenantRow = {
  ROWID: string;

  // ✅ mandatory + unique in your Datastore schema
  salla_store_id: string;

  // ✅ present in schema
  store_name: string;
  store_domain?: string | null;
  timezone?: string | null;

  // ✅ mandatory in schema
  plan_code: string;

  flags_json?: string | null;

  // ✅ mandatory in schema
  status: string;

  // ✅ mandatory + unique in schema
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

function safeParseJsonObject(input: string | null | undefined): Record<string, any> {
  if (!input) return {};
  try {
    const v = JSON.parse(String(input));
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, any>;
    return {};
  } catch {
    return {};
  }
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
        this.cache.set(slugKey, {
          row: { ...cached.row, ...patch },
          exp: Date.now() + this.CACHE_TTL_MS,
        });
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

    await table.updateRow({
      ROWID: tid,
      ...payload,
    });

    this.updateCacheByTenantId(tid, payload as any);
  }

  /**
   * ✅ Fetch flags_json as an object
   */
  static async getFlagsObject(req: any, tenantId: string | number): Promise<Record<string, any>> {
    const tid = assertRowIdDigits(tenantId);

    // best-effort: reuse cache if possible
    for (const cached of this.cache.values()) {
      if (cached.exp > Date.now() && cached.row.ROWID === tid) {
        return safeParseJsonObject(cached.row.flags_json);
      }
    }

    // fallback: scan via findByPortalSlug is not possible without slug
    // so do a small paged search for ROWID match
    const app = getCatalystApp(req);
    const table = app.datastore().table(this.tableName);

    let nextToken: string | undefined = undefined;
    let more = true;
    let loops = 0;

    while (more) {
      const resp = await table.getPagedRows({ nextToken, maxRows: 200 });
      const rows: any[] = resp?.data ?? [];
      const match = rows.find((r) => String(r.ROWID) === tid);

      if (match) {
        const row = this.normalizeRow(match);
        // update cache if we can infer slug key
        const slugKey = normalizeSlug(row.portal_public_slug);
        if (slugKey) this.cache.set(slugKey, { row, exp: Date.now() + this.CACHE_TTL_MS });
        return safeParseJsonObject(row.flags_json);
      }

      more = Boolean(resp?.more_records);
      nextToken = resp?.next_token;

      loops++;
      if (loops > 50) break;
    }

    return {};
  }

  /**
   * ✅ Merge-patch flags_json (safe, no overwrite blast radius)
   */
  static async mergeFlagsObject(
    req: any,
    tenantId: string | number,
    patch: Record<string, any>
  ): Promise<Record<string, any>> {
    const tid = assertRowIdDigits(tenantId);

    const current = await this.getFlagsObject(req, tid);
    const merged = { ...current, ...patch };

    const app = getCatalystApp(req);
    const table = app.datastore().table(this.tableName);

    await table.updateRow({
      ROWID: tid,
      flags_json: JSON.stringify(merged),
    });

    this.updateCacheByTenantId(tid, { flags_json: JSON.stringify(merged) });

    return merged;
  }

  /**
   * ✅ Create tenant row matching your Datastore schema
   */
  static async create(
    req: any,
    args: { portal_public_slug: string; status?: string; plan_code?: string }
  ): Promise<any> {
    const slug = String(args.portal_public_slug ?? "").trim();
    if (!slug) throw new Error("portal_public_slug is required");

    const app = getCatalystApp(req);
    const table = app.datastore().table(this.tableName);

    const row: any = await table.insertRow({
      portal_public_slug: slug,

      status: args.status ?? "draft",
      plan_code: args.plan_code ?? "free",

      salla_store_id: makePendingStoreId(slug),

      store_name: "",
      store_domain: null,
      timezone: null,
      flags_json: null,
    });

    return row;
  }
}
