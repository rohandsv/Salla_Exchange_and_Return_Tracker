import { getCatalystApp } from "../lib/catalyst";

export type TenantRow = {
  ROWID: string; // always string
  salla_store_id: string;
  store_name: string;
  store_domain?: string | null;
  timezone?: string | null;
  plan_code: string;
  flags_json?: string | null;
  status: string;
  portal_public_slug: string;
};

export class TenantsRepo {
  static tableName = "tenants";

  private static cache = new Map<string, { row: TenantRow; exp: number }>();
  private static CACHE_TTL_MS = 5 * 60 * 1000;

  private static normalizeSlug(slug: string) {
    return slug.trim().toLowerCase();
  }

  static async findByPortalSlug(req: any, slug: string): Promise<TenantRow | null> {
    const key = this.normalizeSlug(slug);

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

      const match = rows.find(
        (r) => this.normalizeSlug(String(r.portal_public_slug ?? "")) === key
      );

      if (match) {
        const row: TenantRow = {
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

        this.cache.set(key, { row, exp: Date.now() + this.CACHE_TTL_MS });
        return row;
      }

      more = Boolean(resp?.more_records);
      nextToken = resp?.next_token;
      loops++;
      if (loops > 50) break; // safety guard
    }

    return null;
  }
}
