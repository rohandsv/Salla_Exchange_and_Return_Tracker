import { getCatalystApp } from "../lib/catalyst";
import { toCatalystDateTime } from "../lib/datetime";

function q(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function assertRowIdDigits(id: string | number) {
  const v = String(id ?? "").trim();
  if (!/^\d+$/.test(v)) throw new Error("ROWID/FK must be digits");
  return v;
}

export type OAuthStateRow = {
  ROWID: string;
  tenant_id: string;
  state: string;
  expires_at: string;
};

export class OAuthStatesRepo {
  static tableName = "oauth_states";

  /**
   * oauth_states columns (per your screenshot):
   * - tenant_id (FK) mandatory
   * - state (varchar) unique + mandatory
   * - expires_at (datetime) mandatory
   */
  static async insert(req: any, row: { tenant_id: string | number; state: string; expires_at: string }) {
    const app = getCatalystApp(req);

    // IMPORTANT: only send columns that exist
    const payload = {
      tenant_id: assertRowIdDigits(row.tenant_id),
      state: String(row.state),
      expires_at: String(row.expires_at),
    };

    return app.datastore().table(this.tableName).insertRow(payload);
  }

  static async findValid(req: any, state: string): Promise<OAuthStateRow | null> {
    const app = getCatalystApp(req);
    const now = toCatalystDateTime(new Date());

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE state = ${q(state)}
        AND expires_at > ${q(now)}
      LIMIT 1
    `;

    const res = await app.zcql().executeZCQLQuery(query);
    if (!res?.length) return null;

    const row = res[0][this.tableName] as any;

    return {
      ...row,
      ROWID: String(row.ROWID),
      tenant_id: String(row.tenant_id),
      state: String(row.state),
      expires_at: String(row.expires_at),
    };
  }

  static async deleteByRowId(req: any, rowId: string | number) {
    const app = getCatalystApp(req);
    return app.datastore().table(this.tableName).deleteRow(assertRowIdDigits(rowId) as any);
  }
}
