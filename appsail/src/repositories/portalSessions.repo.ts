import { getCatalystApp } from "../lib/catalyst";
import { toCatalystDateTime } from "../lib/datetime";

function q(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export type PortalSessionRow = {
  ROWID: string;
  tenant_id: string;
  session_token_hash: string;
  contact_hash: string;
  order_number: string;
  expires_at: string;
  created_ip?: string | null;
  last_seen_at?: string | null;
};

export class PortalSessionsRepo {
  static tableName = "portal_sessions";

  static async insert(req: any, row: Record<string, any>) {
    const app = getCatalystApp(req);
    return app.datastore().table(this.tableName).insertRow(row);
  }

  /**
   * Fetch by token hash only. Do NOT compare expires_at in ZCQL.
   * We'll validate expiry in Node to avoid timezone mismatch problems.
   */
  static async findByTokenHash(req: any, tokenHash: string): Promise<PortalSessionRow | null> {
    const app = getCatalystApp(req);

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE session_token_hash = ${q(tokenHash)}
      ORDER BY CREATEDTIME DESC
      LIMIT 1
    `;

    const res = await app.zcql().executeZCQLQuery(query);
    if (!res || res.length === 0) return null;

    const row = res[0][this.tableName] as any;

    // Normalize as strings (Catalyst often returns bigint-like values)
    row.ROWID = String(row.ROWID);
    row.tenant_id = String(row.tenant_id);
    row.expires_at = String(row.expires_at);
    row.order_number = String(row.order_number);
    row.session_token_hash = String(row.session_token_hash);
    row.contact_hash = String(row.contact_hash);

    return row as PortalSessionRow;
  }

  static async touchLastSeen(req: any, rowId: string) {
    const app = getCatalystApp(req);
    return app.datastore().table(this.tableName).updateRow({
      ROWID: rowId,
      last_seen_at: toCatalystDateTime(new Date()),
    });
  }
}
