// appsail/src/repositories/webhookEvents.repo.ts
import { getCatalystApp } from "../lib/catalyst";
import { toCatalystDateTime } from "../lib/datetime";

function q(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function safeJsonStringify(v: any): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "{}";
  }
}

/**
 * Catalyst may return booleans as true/false, 1/0, or "true"/"false".
 * Boolean("false") === true -> so we must normalize deterministically.
 */
function toBool(v: any): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;

  const s = String(v ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(s)) return true;
  if (["false", "0", "no", "n", "off", ""].includes(s)) return false;

  return false;
}

export type WebhookEventRow = {
  ROWID: string;
  tenant_id?: string | null;

  event_type: string;
  event_id_external?: string | null;
  idempotency_key: string;

  signature_valid: boolean;
  payload_json: string;
  received_at: string;

  process_status: string; // pending|processing|done|failed
  retry_count: number;
};

export class WebhookEventsRepo {
  static tableName = "webhook_events_salla";

  private static normalizeRow(row: any): WebhookEventRow {
    return {
      ...row,
      ROWID: String(row.ROWID),
      tenant_id: row.tenant_id == null ? null : String(row.tenant_id),

      event_type: String(row.event_type ?? ""),
      event_id_external: row.event_id_external == null ? null : String(row.event_id_external),
      idempotency_key: String(row.idempotency_key ?? ""),

      signature_valid: toBool(row.signature_valid),

      payload_json: String(row.payload_json ?? "{}"),
      received_at: String(row.received_at ?? ""),

      process_status: String(row.process_status ?? ""),
      retry_count: Number(row.retry_count ?? 0),
    };
  }

  static async findByIdempotencyKey(req: any, idempotencyKey: string): Promise<WebhookEventRow | null> {
    const app = getCatalystApp(req);

    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE idempotency_key = ${q(String(idempotencyKey))}
        LIMIT 1
      `;
      const res = await app.zcql().executeZCQLQuery(query);
      if (!res || res.length === 0) return null;

      const row = res[0][this.tableName] as any;
      return this.normalizeRow(row);
    } catch {
      // fallback scan (for environments where ZCQL behaves unexpectedly)
      const table = app.datastore().table(this.tableName);
      let nextToken: string | undefined = undefined;
      let more = true;
      let loops = 0;

      while (more) {
        const page = await table.getPagedRows({ nextToken, maxRows: 200 });
        const rows = (page?.data ?? []) as any[];

        const match = rows.find((r) => String(r.idempotency_key ?? "") === String(idempotencyKey));
        if (match) return this.normalizeRow(match);

        more = Boolean(page?.more_records);
        nextToken = page?.next_token;

        loops++;
        if (loops > 50) break;
      }

      return null;
    }
  }

  /**
   * Idempotent insert:
   * - tries insert
   * - on unique/duplicate, returns existing
   */
  static async insertPendingIdempotent(
    req: any,
    payload: {
      tenant_id?: string | null;
      event_type: string;
      event_id_external?: string | null;
      idempotency_key: string;
      signature_valid: boolean;
      body: any;
      received_at?: string;
    }
  ): Promise<{ row: WebhookEventRow; inserted: boolean }> {
    const app = getCatalystApp(req);
    const table = app.datastore().table(this.tableName);

    const rowToInsert: any = {
      event_type: String(payload.event_type ?? "unknown"),
      event_id_external: payload.event_id_external ? String(payload.event_id_external) : null,
      idempotency_key: String(payload.idempotency_key),
      signature_valid: Boolean(payload.signature_valid),
      payload_json: safeJsonStringify(payload.body ?? {}),
      received_at: String(payload.received_at ?? toCatalystDateTime(new Date())),
      process_status: "pending",
      retry_count: 0,
    };

    if (payload.tenant_id) rowToInsert.tenant_id = String(payload.tenant_id);

    try {
      const inserted: any = await table.insertRow(rowToInsert);
      return { row: this.normalizeRow(inserted), inserted: true };
    } catch (e: any) {
      const msg = String(e?.message ?? "").toLowerCase();
      const isDup = msg.includes("unique") || msg.includes("duplicate");
      if (!isDup) throw e;

      const existing = await this.findByIdempotencyKey(req, rowToInsert.idempotency_key);
      if (!existing) {
        // rare: insert failed but lookup didn't find it
        return { row: this.normalizeRow({ ROWID: "0", ...rowToInsert }), inserted: false };
      }
      return { row: existing, inserted: false };
    }
  }

  /**
   * Fetch pending rows for processing.
   * Uses only existing columns in your table.
   */
  static async listPendingBatch(
    req: any,
    opts: { limit?: number; maxRetries?: number } = {}
  ): Promise<WebhookEventRow[]> {
    const app = getCatalystApp(req);

    const limit = Number.isFinite(opts.limit) && (opts.limit as number) > 0 ? (opts.limit as number) : 25;
    const maxRetries =
      Number.isFinite(opts.maxRetries) && (opts.maxRetries as number) >= 0 ? (opts.maxRetries as number) : 5;

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE (process_status = ${q("pending")} OR process_status = ${q("failed")})
      AND retry_count < ${maxRetries}
      ORDER BY received_at ASC
      LIMIT ${limit}
    `;

    const res = await app.zcql().executeZCQLQuery(query);
    if (!res?.length) return [];

    return res.map((r: any) => this.normalizeRow(r[this.tableName]));
  }

  /**
   * Mark as processing (best-effort).
   */
  static async markProcessing(req: any, rowId: string) {
    const app = getCatalystApp(req);
    return app.datastore().table(this.tableName).updateRow({
      ROWID: String(rowId),
      process_status: "processing",
    });
  }

  static async markDone(req: any, rowId: string) {
    const app = getCatalystApp(req);
    return app.datastore().table(this.tableName).updateRow({
      ROWID: String(rowId),
      process_status: "done",
    });
  }

  static async markFailedAndIncrementRetry(req: any, rowId: string, currentRetryCount: number) {
    const app = getCatalystApp(req);
    return app.datastore().table(this.tableName).updateRow({
      ROWID: String(rowId),
      process_status: "failed",
      retry_count: Number(currentRetryCount ?? 0) + 1,
    });
  }
}
