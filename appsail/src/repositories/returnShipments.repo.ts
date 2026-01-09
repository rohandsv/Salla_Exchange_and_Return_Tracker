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
 * NOTE:
 * Keep fields optional so this repo compiles even if your table has extra columns.
 * Ensure your table has at least: tenant_id, return_request_id (FKs) if you plan to use it now.
 */
export type ReturnShipmentRow = {
  ROWID: string;
  tenant_id: string;
  return_request_id: string;

  shipment_status?: string;
  carrier?: string | null;
  tracking_number?: string | null;

  pickup_scheduled_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;

  label_file_id?: string | null;
  meta_json?: string | null;
};

export class ReturnShipmentsRepo {
  static tableName = "return_shipments";

  static async insert(req: any, row: Record<string, any>) {
    const app = getCatalystApp(req);

    if (row.tenant_id != null) row.tenant_id = assertRowIdDigits(row.tenant_id);
    if (row.return_request_id != null) row.return_request_id = assertRowIdDigits(row.return_request_id);

    return app.datastore().table(this.tableName).insertRow(row);
  }

  static async listByReturnRequestId(
    req: any,
    tenantId: string | number,
    returnRequestId: string | number
  ): Promise<ReturnShipmentRow[]> {
    const app = getCatalystApp(req);
    const tid = assertRowIdDigits(tenantId);
    const rrid = assertRowIdDigits(returnRequestId);

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = ${tid}
        AND return_request_id = ${rrid}
      ORDER BY CREATEDTIME ASC
      LIMIT 200
    `;

    const res = await app.zcql().executeZCQLQuery(query);
    if (!res || res.length === 0) return [];

    return res.map((r: any) => {
      const row = r[this.tableName] as any;
      row.ROWID = String(row.ROWID);
      row.tenant_id = String(row.tenant_id);
      row.return_request_id = String(row.return_request_id);
      return row as ReturnShipmentRow;
    });
  }

  static async update(req: any, row: Record<string, any> & { ROWID: string | number }) {
    const app = getCatalystApp(req);
    row.ROWID = assertRowIdDigits(row.ROWID);

    if (row.tenant_id != null) row.tenant_id = assertRowIdDigits(row.tenant_id);
    if (row.return_request_id != null) row.return_request_id = assertRowIdDigits(row.return_request_id);

    // useful default touch fields if caller passes Date
    for (const k of ["pickup_scheduled_at", "shipped_at", "delivered_at"]) {
      if (row[k] instanceof Date) row[k] = toCatalystDateTime(row[k]);
    }

    return app.datastore().table(this.tableName).updateRow(row);
  }

  static async deleteById(req: any, rowId: string | number) {
    const app = getCatalystApp(req);
    const rid = assertRowIdDigits(rowId);
    return app.datastore().table(this.tableName).deleteRow(rid as any);
  }
}
