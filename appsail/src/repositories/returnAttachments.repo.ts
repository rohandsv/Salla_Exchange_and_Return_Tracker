import { getCatalystApp } from "../lib/catalyst";

function assertRowIdDigits(id: string | number) {
  const v = String(id);
  if (!/^\d+$/.test(v)) throw new Error("ROWID/FK must be digits");
  return v;
}

export type ReturnAttachmentRow = {
  ROWID: string;
  tenant_id: string;
  return_request_id: string;

  file_id: string; // filestore object id / catalyst file id
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;

  uploaded_by?: string | null; // portal/admin
  meta_json?: string | null;
};

export class ReturnAttachmentsRepo {
  static tableName = "return_attachments";

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
  ): Promise<ReturnAttachmentRow[]> {
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
      return row as ReturnAttachmentRow;
    });
  }
}
