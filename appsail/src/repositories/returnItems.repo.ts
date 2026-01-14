// appsail/src/repositories/returnItems.repo.ts
import { getCatalystApp } from "../lib/catalyst";

function assertRowIdDigits(id: string | number) {
  const v = String(id);
  if (!/^\d+$/.test(v)) throw new Error("ROWID/FK must be digits");
  return v;
}

export type ReturnItemRow = {
  ROWID: string;
  tenant_id: string;
  return_request_id: string;

  order_item_id_external?: string | null;
  sku: string;
  product_name?: string | null;
  variant_name?: string | null;
  category_id_external?: string | null;

  quantity: number;
  unit_price?: number | null;

  reason_code: string;
  reason_note?: string | null;

  decision: string;
  decision_reason?: string | null;
};

export class ReturnItemsRepo {
  static tableName = "return_items";

  static async insert(req: any, row: Record<string, any>) {
    const app = getCatalystApp(req);

    if (row.tenant_id != null) row.tenant_id = assertRowIdDigits(row.tenant_id);
    if (row.return_request_id != null) row.return_request_id = assertRowIdDigits(row.return_request_id);

    return app.datastore().table(this.tableName).insertRow(row);
  }

  static async bulkInsert(req: any, rows: Record<string, any>[], concurrency = 5) {
    const results: any[] = [];
    const queue = [...rows];

    const workers = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
      while (queue.length) {
        const row = queue.shift();
        if (!row) break;
        results.push(await this.insert(req, row));
      }
    });

    await Promise.all(workers);
    return results;
  }

  /**
   * ✅ Safe row fetch by ROWID (datastore API, not ZCQL).
   */
  static async findById(req: any, rowId: string | number): Promise<ReturnItemRow | null> {
    const app = getCatalystApp(req);
    const rid = assertRowIdDigits(rowId);

    const table = app.datastore().table(this.tableName);
    const row = await table.getRow(rid as any).catch(() => null);
    if (!row) return null;

    return {
      ...(row as any),
      ROWID: String((row as any).ROWID),
      tenant_id: String((row as any).tenant_id ?? ""),
      return_request_id: String((row as any).return_request_id ?? ""),
    } as ReturnItemRow;
  }

  /**
   * ✅ Update row by ROWID (datastore API)
   */
  static async update(req: any, row: Record<string, any> & { ROWID: string | number }) {
    const app = getCatalystApp(req);

    const payload: any = { ...row };
    payload.ROWID = assertRowIdDigits(payload.ROWID);

    if (payload.tenant_id != null) payload.tenant_id = assertRowIdDigits(payload.tenant_id);
    if (payload.return_request_id != null) payload.return_request_id = assertRowIdDigits(payload.return_request_id);

    return app.datastore().table(this.tableName).updateRow(payload);
  }

  static async bulkUpdate(req: any, rows: Array<Record<string, any> & { ROWID: string | number }>, concurrency = 5) {
    const results: any[] = [];
    const queue = [...rows];

    const workers = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
      while (queue.length) {
        const row = queue.shift();
        if (!row) break;
        results.push(await this.update(req, row));
      }
    });

    await Promise.all(workers);
    return results;
  }

  /**
   * IMPORTANT: No ZCQL here to avoid BigInt/FK comparison internal errors.
   */
  static async listByReturnRequestId(
    req: any,
    tenantId: string | number,
    returnRequestId: string | number
  ): Promise<ReturnItemRow[]> {
    const app = getCatalystApp(req);
    const tid = assertRowIdDigits(tenantId);
    const rrid = assertRowIdDigits(returnRequestId);

    const table = app.datastore().table(this.tableName);

    let nextToken: string | undefined = undefined;
    let more = true;

    const out: ReturnItemRow[] = [];

    while (more) {
      const resp = await table.getPagedRows({ nextToken, maxRows: 200 });
      const rows: any[] = resp?.data ?? [];

      for (const r of rows) {
        const rTid = String(r.tenant_id ?? "");
        const rRrid = String(r.return_request_id ?? "");
        if (rTid === tid && rRrid === rrid) {
          out.push({
            ...r,
            ROWID: String(r.ROWID),
            tenant_id: rTid,
            return_request_id: rRrid,
          });
        }
      }

      more = Boolean(resp?.more_records);
      nextToken = resp?.next_token;
      if (!more) break;
    }

    // Createdtime ordering (oldest first) to match earlier behavior
    out.sort((a: any, b: any) => {
      const ta = Date.parse((a as any).CREATEDTIME || (a as any).created_time || "") || 0;
      const tb = Date.parse((b as any).CREATEDTIME || (b as any).created_time || "") || 0;
      return ta - tb;
    });

    return out.slice(0, 300);
  }

  static async deleteByReturnRequestId(req: any, tenantId: string | number, returnRequestId: string | number) {
    const app = getCatalystApp(req);
    const rows = await this.listByReturnRequestId(req, tenantId, returnRequestId);
    const table = app.datastore().table(this.tableName);

    for (const r of rows) {
      await table.deleteRow(String(r.ROWID) as any);
    }
  }
}
