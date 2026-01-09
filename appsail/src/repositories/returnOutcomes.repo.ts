import { getCatalystApp } from "../lib/catalyst";
import { toCatalystDateTime } from "../lib/datetime";

function q(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function assertRowIdDigits(id: string | number) {
  const v = String(id);
  if (!/^\d+$/.test(v)) throw new Error("ROWID/FK must be digits");
  return v;
}

/**
 * Keep optional fields; align with your table when you finalize outcomes workflow.
 */
export type ReturnOutcomeRow = {
  ROWID: string;
  tenant_id: string;
  return_request_id: string;

  outcome_type?: string; // e.g. refund | exchange | store_credit | reject
  outcome_reason?: string | null;

  refund_transaction_id_external?: string | null;
  exchange_order_id_external?: string | null;
  store_credit_ref_external?: string | null;

  decided_at?: string | null;
  meta_json?: string | null;
};

export class ReturnOutcomesRepo {
  static tableName = "return_outcomes";

  static async insert(req: any, row: Record<string, any>) {
    const app = getCatalystApp(req);

    if (row.tenant_id != null) row.tenant_id = assertRowIdDigits(row.tenant_id);
    if (row.return_request_id != null) row.return_request_id = assertRowIdDigits(row.return_request_id);
    if (row.decided_at instanceof Date) row.decided_at = toCatalystDateTime(row.decided_at);

    return app.datastore().table(this.tableName).insertRow(row);
  }

  static async findLatestByReturnRequestId(
    req: any,
    tenantId: string | number,
    returnRequestId: string | number
  ): Promise<ReturnOutcomeRow | null> {
    const app = getCatalystApp(req);
    const tid = assertRowIdDigits(tenantId);
    const rrid = assertRowIdDigits(returnRequestId);

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = ${tid}
        AND return_request_id = ${rrid}
      ORDER BY CREATEDTIME DESC
      LIMIT 1
    `;

    const res = await app.zcql().executeZCQLQuery(query);
    if (!res || res.length === 0) return null;

    const row = res[0][this.tableName] as any;
    row.ROWID = String(row.ROWID);
    row.tenant_id = String(row.tenant_id);
    row.return_request_id = String(row.return_request_id);
    return row as ReturnOutcomeRow;
  }

  static async update(req: any, row: Record<string, any> & { ROWID: string | number }) {
    const app = getCatalystApp(req);
    row.ROWID = assertRowIdDigits(row.ROWID);

    if (row.tenant_id != null) row.tenant_id = assertRowIdDigits(row.tenant_id);
    if (row.return_request_id != null) row.return_request_id = assertRowIdDigits(row.return_request_id);
    if (row.decided_at instanceof Date) row.decided_at = toCatalystDateTime(row.decided_at);

    return app.datastore().table(this.tableName).updateRow(row);
  }
}
