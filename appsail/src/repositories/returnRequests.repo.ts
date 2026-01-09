import { getCatalystApp } from "../lib/catalyst";

function q(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function assertRowIdDigits(id: string | number) {
  const v = String(id);
  if (!/^\d+$/.test(v)) throw new Error("ROWID must be digits");
  return v;
}

export type ReturnRequestRow = {
  ROWID: string;
  tenant_id: string;

  return_number: string;
  order_number: string;
  order_id_external?: string | null;

  customer_contact_masked?: string | null;
  customer_contact_hash: string;

  requested_resolution: string;
  status: string;
  status_reason?: string | null;

  requested_at: string;
  approved_at?: string | null;
  received_at?: string | null;
  resolved_at?: string | null;

  policy_snapshot_json?: string | null;
  notes_internal?: string | null;
  notes_customer?: string | null;

  total_items_count: number;
  total_request_value?: number | null;

  exchange_order_id_external?: string | null;
  refund_transaction_id_external?: string | null;
  store_credit_ref_external?: string | null;

  is_warranty: boolean;
  customer_cancelled_at?: string | null;
};

export class ReturnRequestsRepo {
  static tableName = "return_requests";

  static async insert(req: any, row: Record<string, any>) {
    const app = getCatalystApp(req);
    if (row.tenant_id != null) row.tenant_id = assertRowIdDigits(row.tenant_id);
    return app.datastore().table(this.tableName).insertRow(row);
  }

  static async findByReturnNumber(
    req: any,
    tenantId: string | number,
    returnNumber: string
  ): Promise<ReturnRequestRow | null> {
    const app = getCatalystApp(req);
    const tid = assertRowIdDigits(tenantId);

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = ${tid}
        AND return_number = ${q(returnNumber)}
      LIMIT 1
    `;

    const res = await app.zcql().executeZCQLQuery(query);
    if (!res || res.length === 0) return null;

    const row = res[0][this.tableName] as any;
    row.ROWID = String(row.ROWID);
    row.tenant_id = String(row.tenant_id);
    return row as ReturnRequestRow;
  }

  static async findById(
    req: any,
    tenantId: string | number,
    rowId: string | number
  ): Promise<ReturnRequestRow | null> {
    const app = getCatalystApp(req);
    const tid = assertRowIdDigits(tenantId);
    const rid = assertRowIdDigits(rowId);

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = ${tid}
        AND ROWID = ${rid}
      LIMIT 1
    `;

    const res = await app.zcql().executeZCQLQuery(query);
    if (!res || res.length === 0) return null;

    const row = res[0][this.tableName] as any;
    row.ROWID = String(row.ROWID);
    row.tenant_id = String(row.tenant_id);
    return row as ReturnRequestRow;
  }

  static async listByOrderNumber(
    req: any,
    tenantId: string | number,
    orderNumber: string
  ): Promise<ReturnRequestRow[]> {
    const app = getCatalystApp(req);
    const tid = assertRowIdDigits(tenantId);

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = ${tid}
        AND order_number = ${q(orderNumber)}
      ORDER BY CREATEDTIME DESC
      LIMIT 200
    `;

    const res = await app.zcql().executeZCQLQuery(query);
    if (!res || res.length === 0) return [];

    return res.map((r: any) => {
      const row = r[this.tableName] as any;
      row.ROWID = String(row.ROWID);
      row.tenant_id = String(row.tenant_id);
      return row as ReturnRequestRow;
    });
  }

  static async update(req: any, row: Record<string, any> & { ROWID: string | number }) {
    const app = getCatalystApp(req);
    if (row.tenant_id != null) row.tenant_id = assertRowIdDigits(row.tenant_id);
    row.ROWID = assertRowIdDigits(row.ROWID);
    return app.datastore().table(this.tableName).updateRow(row);
  }

  static async deleteById(req: any, rowId: string | number) {
    const app = getCatalystApp(req);
    const rid = assertRowIdDigits(rowId);
    return app.datastore().table(this.tableName).deleteRow(rid as any);
  }
}
