import { getCatalystApp } from "../lib/catalyst";
import { logger } from "../lib/logger";
import { toCatalystDateTime } from "../lib/datetime";

function sanitizeBigInt(value: any): any {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(sanitizeBigInt);
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeBigInt(v);
    return out;
  }
  return value;
}

function assertRowIdDigits(id: string | number) {
  const v = String(id);
  if (!/^\d+$/.test(v)) throw new Error("ROWID/FK must be digits");
  return v;
}

export class AuditEventsRepo {
  static tableName = "audit_events";

  /**
   * Best-effort insert. Will never break main flow.
   * Ensure you pass tenant_id as digits string/number (FK to tenants).
   */
  static async log(req: any, row: Record<string, any>) {
    try {
      const app = getCatalystApp(req);

      const payload: any = sanitizeBigInt({ ...row });

      // normalize common keys if present
      if (payload.tenant_id != null) payload.tenant_id = assertRowIdDigits(payload.tenant_id);
      if (payload.created_at instanceof Date) payload.created_at = toCatalystDateTime(payload.created_at);

      return await app.datastore().table(this.tableName).insertRow(payload);
    } catch (e: any) {
      logger.warn(
        {
          requestId: req.requestId,
          err: e?.message || String(e),
        },
        "Audit insert failed (ignored)"
      );
      return null;
    }
  }
}
