import { getCatalystApp } from "../lib/catalyst";

function assertRowIdDigits(id: string | number) {
  const v = String(id ?? "").trim();
  if (!/^\d+$/.test(v)) throw new Error("ROWID/FK must be digits");
  return v;
}

const ALLOWED_COLUMNS = new Set([
  "tenant_id",
  "access_token_enc",
  "refresh_token_enc",
  "token_type",
  "scopes",
  "access_token_expires_at",
  "last_token_refresh_at",
  "token_status",
  "installed_at",
  "uninstalled_at",
  "tenant_unique_key",
]);

function pickAllowed(patch: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (ALLOWED_COLUMNS.has(k)) out[k] = v;
  }
  return out;
}

export type SallaOauthTokenRow = {
  ROWID: string;
  tenant_id: string;

  access_token_enc: string;
  refresh_token_enc?: string | null;

  token_type?: string | null;
  scopes?: string | null;

  access_token_expires_at?: string | null;
  last_token_refresh_at?: string | null;

  token_status: string; // active
  installed_at?: string | null;
  uninstalled_at?: string | null;

  tenant_unique_key: string;
};

export class SallaOauthTokensRepo {
  static tableName = "salla_oauth_tokens";

  static async insert(req: any, row: Record<string, any>) {
    const app = getCatalystApp(req);

    const payload = pickAllowed(row);

    if (payload.tenant_id != null) payload.tenant_id = assertRowIdDigits(payload.tenant_id);

    return app.datastore().table(this.tableName).insertRow(payload);
  }

  static async update(req: any, row: Record<string, any> & { ROWID: string | number }) {
    const app = getCatalystApp(req);

    const payload = pickAllowed(row) as Record<string, any>;
    payload.ROWID = assertRowIdDigits(row.ROWID);

    if (payload.tenant_id != null) payload.tenant_id = assertRowIdDigits(payload.tenant_id);

    return app.datastore().table(this.tableName).updateRow(payload as any);
  }

  /**
   * ZCQL LIMIT must be <= 300. We use LIMIT 1 here.
   */
  static async findByTenantId(req: any, tenantId: string | number): Promise<SallaOauthTokenRow | null> {
    const app = getCatalystApp(req);
    const tid = assertRowIdDigits(tenantId);

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = ${tid}
      LIMIT 1
    `;

    const res = await app.zcql().executeZCQLQuery(query);
    if (!res?.length) return null;

    const row = res[0][this.tableName] as any;
    return {
      ...row,
      ROWID: String(row.ROWID),
      tenant_id: String(row.tenant_id),
    } as SallaOauthTokenRow;
  }

  static async upsertByTenant(req: any, tenantId: string | number, patch: Record<string, any>) {
    const tid = assertRowIdDigits(tenantId);

    const existing = await this.findByTenantId(req, tid);
    if (!existing) {
      return this.insert(req, { tenant_id: tid, ...patch });
    }

    return this.update(req, { ROWID: existing.ROWID, tenant_id: tid, ...patch });
  }
}
