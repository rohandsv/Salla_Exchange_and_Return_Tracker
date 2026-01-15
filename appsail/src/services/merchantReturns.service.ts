// appsail/src/services/merchantReturns.service.ts
import { z } from "zod";
import { AppError } from "../lib/errors";
import { toCatalystDateTime } from "../lib/datetime";
import { ReturnRequestsRepo } from "../repositories/returnRequests.repo";
import { ReturnItemsRepo } from "../repositories/returnItems.repo";
import { AuditEventsRepo } from "../repositories/auditEvents.repo";

function assertRowIdDigits(id: string | number) {
  const v = String(id ?? "");
  if (!/^\d+$/.test(v)) throw new Error("ROWID/FK must be digits");
  return v;
}

function actorFromReq(req: any) {
  // Works even with placeholder auth. If later you add real merchant identity, it will populate.
  const actorId = String(req?.merchant?.id ?? req?.merchant?.email ?? req?.user?.id ?? "merchant");
  return { actor_type: "merchant", actor_id: actorId };
}

const itemDecisionSchema = z.object({
  return_item_id: z.string().min(1),
  decision: z.string().min(1), // e.g. "approved" | "rejected" | "pending"
  decision_reason: z.string().optional(),
});

export class MerchantReturnsService {
  static async getReturnWithItems(req: any, tenantId: string | number, returnNumber: string) {
    const tid = assertRowIdDigits(tenantId);
    const rr = await ReturnRequestsRepo.findByReturnNumber(req, tid, returnNumber);
    if (!rr) throw new AppError(404, "Return not found", "RETURN_NOT_FOUND");

    const items = await ReturnItemsRepo.listByReturnRequestId(req, tid, rr.ROWID);

    return { rr, items };
  }

  static async setItemDecisions(
    req: any,
    tenantId: string | number,
    returnNumber: string,
    decisions: Array<z.infer<typeof itemDecisionSchema>>
  ) {
    const tid = assertRowIdDigits(tenantId);
    const { rr, items } = await this.getReturnWithItems(req, tid, returnNumber);

    const itemsById = new Map(items.map((it) => [String(it.ROWID), it]));

    const updates = decisions.map((d) => {
      const id = String(d.return_item_id);
      const existing = itemsById.get(id);
      if (!existing) throw new AppError(400, "Invalid return_item_id for this return", "RETURN_ITEM_INVALID");

      return {
        ROWID: id,
        decision: String(d.decision),
        decision_reason: d.decision_reason ? String(d.decision_reason) : null,
      };
    });

    await ReturnItemsRepo.bulkUpdate(req, updates, 5);

    await AuditEventsRepo.log(req, {
      tenant_id: tid,
      ...actorFromReq(req),
      action: "return_items_updated",
      entity: "return_requests",
      entity_id: String(rr.ROWID),
      request_id: req.requestId || null,
      ip: req.ip || null,
      user_agent: req.headers?.["user-agent"] || null,
      details_json: JSON.stringify({
        return_number: rr.return_number,
        updates_count: updates.length,
      }),
      created_at: toCatalystDateTime(new Date()),
    });

    return this.getReturnWithItems(req, tid, returnNumber);
  }

  static async approve(req: any, tenantId: string | number, returnNumber: string, args?: any) {
    const tid = assertRowIdDigits(tenantId);
    const nowStr = toCatalystDateTime(new Date());

    const { rr } = await this.getReturnWithItems(req, tid, returnNumber);

    // Optional: item decisions included along with approval
    const decisions = Array.isArray(args?.items) ? args.items : null;
    if (decisions) {
      const parsed = z.array(itemDecisionSchema).parse(decisions);
      await this.setItemDecisions(req, tid, returnNumber, parsed);
    }

    await ReturnRequestsRepo.update(req, {
      ROWID: rr.ROWID,
      tenant_id: tid,
      status: "approved",
      status_reason: args?.status_reason ? String(args.status_reason) : null,
      notes_internal: args?.notes_internal ? String(args.notes_internal) : rr.notes_internal ?? null,
      approved_at: nowStr,
    });

    await AuditEventsRepo.log(req, {
      tenant_id: tid,
      ...actorFromReq(req),
      action: "return_approved",
      entity: "return_requests",
      entity_id: String(rr.ROWID),
      request_id: req.requestId || null,
      ip: req.ip || null,
      user_agent: req.headers?.["user-agent"] || null,
      details_json: JSON.stringify({
        return_number: rr.return_number,
        order_number: rr.order_number,
      }),
      created_at: nowStr,
    });

    return this.getReturnWithItems(req, tid, returnNumber);
  }

  static async reject(req: any, tenantId: string | number, returnNumber: string, args?: any) {
    const tid = assertRowIdDigits(tenantId);
    const nowStr = toCatalystDateTime(new Date());

    const { rr } = await this.getReturnWithItems(req, tid, returnNumber);

    await ReturnRequestsRepo.update(req, {
      ROWID: rr.ROWID,
      tenant_id: tid,
      status: "rejected",
      status_reason: args?.status_reason ? String(args.status_reason) : null,
      notes_internal: args?.notes_internal ? String(args.notes_internal) : rr.notes_internal ?? null,
      resolved_at: nowStr, // rejection closes it
    });

    await AuditEventsRepo.log(req, {
      tenant_id: tid,
      ...actorFromReq(req),
      action: "return_rejected",
      entity: "return_requests",
      entity_id: String(rr.ROWID),
      request_id: req.requestId || null,
      ip: req.ip || null,
      user_agent: req.headers?.["user-agent"] || null,
      details_json: JSON.stringify({
        return_number: rr.return_number,
        order_number: rr.order_number,
      }),
      created_at: nowStr,
    });

    return this.getReturnWithItems(req, tid, returnNumber);
  }

  static async markReceived(req: any, tenantId: string | number, returnNumber: string, args?: any) {
    const tid = assertRowIdDigits(tenantId);
    const nowStr = toCatalystDateTime(new Date());

    const { rr } = await this.getReturnWithItems(req, tid, returnNumber);

    await ReturnRequestsRepo.update(req, {
      ROWID: rr.ROWID,
      tenant_id: tid,
      status: "received",
      status_reason: args?.status_reason ? String(args.status_reason) : rr.status_reason ?? null,
      notes_internal: args?.notes_internal ? String(args.notes_internal) : rr.notes_internal ?? null,
      received_at: nowStr,
    });

    await AuditEventsRepo.log(req, {
      tenant_id: tid,
      ...actorFromReq(req),
      action: "return_received",
      entity: "return_requests",
      entity_id: String(rr.ROWID),
      request_id: req.requestId || null,
      ip: req.ip || null,
      user_agent: req.headers?.["user-agent"] || null,
      details_json: JSON.stringify({
        return_number: rr.return_number,
        order_number: rr.order_number,
      }),
      created_at: nowStr,
    });

    return this.getReturnWithItems(req, tid, returnNumber);
  }

  static async resolve(req: any, tenantId: string | number, returnNumber: string, args: any) {
    const tid = assertRowIdDigits(tenantId);
    const nowStr = toCatalystDateTime(new Date());

    const { rr } = await this.getReturnWithItems(req, tid, returnNumber);

    const schema = z.object({
      type: z.enum(["refund", "exchange", "store_credit"]),
      refund_transaction_id_external: z.string().optional(),
      exchange_order_id_external: z.string().optional(),
      store_credit_ref_external: z.string().optional(),
      status_reason: z.string().optional(),
      notes_internal: z.string().optional(),
    });

    const body = schema.parse(args ?? {});

    const updatePayload: any = {
      ROWID: rr.ROWID,
      tenant_id: tid,
      status: "resolved",
      status_reason: body.status_reason ? String(body.status_reason) : rr.status_reason ?? null,
      notes_internal: body.notes_internal ? String(body.notes_internal) : rr.notes_internal ?? null,
      resolved_at: nowStr,
    };

    if (body.type === "refund") {
      updatePayload.refund_transaction_id_external = body.refund_transaction_id_external
        ? String(body.refund_transaction_id_external)
        : rr.refund_transaction_id_external ?? null;
    }

    if (body.type === "exchange") {
      updatePayload.exchange_order_id_external = body.exchange_order_id_external
        ? String(body.exchange_order_id_external)
        : rr.exchange_order_id_external ?? null;
    }

    if (body.type === "store_credit") {
      updatePayload.store_credit_ref_external = body.store_credit_ref_external
        ? String(body.store_credit_ref_external)
        : rr.store_credit_ref_external ?? null;
    }

    await ReturnRequestsRepo.update(req, updatePayload);

    await AuditEventsRepo.log(req, {
      tenant_id: tid,
      ...actorFromReq(req),
      action: "return_resolved",
      entity: "return_requests",
      entity_id: String(rr.ROWID),
      request_id: req.requestId || null,
      ip: req.ip || null,
      user_agent: req.headers?.["user-agent"] || null,
      details_json: JSON.stringify({
        return_number: rr.return_number,
        order_number: rr.order_number,
        resolution_type: body.type,
      }),
      created_at: nowStr,
    });

    return this.getReturnWithItems(req, tid, returnNumber);
  }
}
