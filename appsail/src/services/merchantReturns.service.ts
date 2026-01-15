// appsail/src/services/merchantReturns.service.ts
import { AppError } from "../lib/errors";
import { toCatalystDateTime } from "../lib/datetime";
import { ReturnRequestsRepo } from "../repositories/returnRequests.repo";
import { ReturnItemsRepo } from "../repositories/returnItems.repo";
import { AuditEventsRepo } from "../repositories/auditEvents.repo";

function normStatus(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function actorId(req: any) {
  return String(req.merchantUserId ?? req.userId ?? "");
}

export class MerchantReturnsService {
  /**
   * ✅ Update item decisions for a return request
   * (does not change return status)
   */
  static async setItemDecisions(
    req: any,
    tenantIdRaw: string | number,
    returnNumber: string,
    items: Array<{ return_item_id: string; decision: string; decision_reason?: string }>
  ) {
    const tenantId = String(tenantIdRaw || "");
    if (!tenantId) throw new AppError(400, "tenantId missing", "TENANT_REQUIRED");

    const rr = await ReturnRequestsRepo.findByReturnNumber(req, tenantId, returnNumber);
    if (!rr) throw new AppError(404, "Return not found", "RETURN_NOT_FOUND");

    const status = normStatus(rr.status);
    if (!["requested", "approved", "received"].includes(status)) {
      throw new AppError(400, "Item decisions cannot be updated at this stage", "RETURN_ITEM_UPDATE_NOT_ALLOWED", {
        status: rr.status,
      });
    }

    const nowStr = toCatalystDateTime(new Date());

    await ReturnItemsRepo.bulkUpdateDecisionsByIds(
      req,
      tenantId,
      rr.ROWID,
      items.map((it) => ({
        return_item_id: String(it.return_item_id),
        decision: String(it.decision),
        decision_reason: it.decision_reason ?? null,
      })),
      5
    );

    // return latest items
    const updated = await ReturnItemsRepo.listByReturnRequestId(req, tenantId, rr.ROWID);

    await AuditEventsRepo.log(req, {
      tenant_id: tenantId,
      actor_type: "merchant",
      actor_id: actorId(req),
      action: "return_items_updated",
      entity: "return_requests",
      entity_id: String(rr.ROWID),
      request_id: req.requestId || null,
      ip: req.ip || null,
      user_agent: req.headers?.["user-agent"] || null,
      details_json: JSON.stringify({
        return_number: rr.return_number,
        order_number: rr.order_number,
        items_updated: items.length,
      }),
      created_at: nowStr,
    });

    return {
      rr,
      items: updated.map((it: any) => ({
        return_item_id: it.ROWID,
        sku: it.sku,
        quantity: Number(it.quantity ?? 0),
        unit_price: it.unit_price == null ? null : Number(it.unit_price),
        decision: it.decision,
        decision_reason: it.decision_reason ?? null,
      })),
    };
  }

  /**
   * ✅ Approve return (optionally set item decisions)
   */
  static async approve(
    req: any,
    tenantIdRaw: string | number,
    returnNumber: string,
    payload: {
      status_reason?: string;
      notes_internal?: string;
      items?: Array<{ return_item_id: string; decision: string; decision_reason?: string }>;
    }
  ) {
    const tenantId = String(tenantIdRaw || "");
    if (!tenantId) throw new AppError(400, "tenantId missing", "TENANT_REQUIRED");

    const rr = await ReturnRequestsRepo.findByReturnNumber(req, tenantId, returnNumber);
    if (!rr) throw new AppError(404, "Return not found", "RETURN_NOT_FOUND");

    const status = normStatus(rr.status);
    if (status !== "requested") {
      throw new AppError(400, "Return cannot be approved at this stage", "RETURN_APPROVE_NOT_ALLOWED", {
        status: rr.status,
      });
    }

    const nowStr = toCatalystDateTime(new Date());

    // 1) optional item decision update first
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length) {
      await ReturnItemsRepo.bulkUpdateDecisionsByIds(
        req,
        tenantId,
        rr.ROWID,
        items.map((it) => ({
          return_item_id: String(it.return_item_id),
          decision: String(it.decision),
          decision_reason: it.decision_reason ?? null,
        })),
        5
      );
    }

    // 2) approve request
    await ReturnRequestsRepo.update(req, {
      ROWID: rr.ROWID,
      tenant_id: tenantId,
      status: "approved",
      status_reason: payload.status_reason ? String(payload.status_reason) : rr.status_reason ?? null,
      approved_at: nowStr,
      notes_internal: payload.notes_internal != null ? String(payload.notes_internal) : rr.notes_internal ?? null,
    });

    const updatedItems = await ReturnItemsRepo.listByReturnRequestId(req, tenantId, rr.ROWID);

    await AuditEventsRepo.log(req, {
      tenant_id: tenantId,
      actor_type: "merchant",
      actor_id: actorId(req),
      action: "return_approved",
      entity: "return_requests",
      entity_id: String(rr.ROWID),
      request_id: req.requestId || null,
      ip: req.ip || null,
      user_agent: req.headers?.["user-agent"] || null,
      details_json: JSON.stringify({
        return_number: rr.return_number,
        order_number: rr.order_number,
        status_reason: payload.status_reason ?? null,
        notes_internal: payload.notes_internal ?? null,
        items_updated: items.length,
      }),
      created_at: nowStr,
    });

    // load fresh rr (optional)
    const rr2 = await ReturnRequestsRepo.findByReturnNumber(req, tenantId, returnNumber);

    return {
      rr: rr2 ?? rr,
      items: updatedItems.map((it: any) => ({
        return_item_id: it.ROWID,
        sku: it.sku,
        quantity: Number(it.quantity ?? 0),
        unit_price: it.unit_price == null ? null : Number(it.unit_price),
        decision: it.decision,
        decision_reason: it.decision_reason ?? null,
      })),
    };
  }

  /**
   * ✅ Reject return
   */
  static async reject(
    req: any,
    tenantIdRaw: string | number,
    returnNumber: string,
    payload: { status_reason?: string; notes_internal?: string }
  ) {
    const tenantId = String(tenantIdRaw || "");
    if (!tenantId) throw new AppError(400, "tenantId missing", "TENANT_REQUIRED");

    const rr = await ReturnRequestsRepo.findByReturnNumber(req, tenantId, returnNumber);
    if (!rr) throw new AppError(404, "Return not found", "RETURN_NOT_FOUND");

    const status = normStatus(rr.status);
    if (status !== "requested") {
      throw new AppError(400, "Return cannot be rejected at this stage", "RETURN_REJECT_NOT_ALLOWED", {
        status: rr.status,
      });
    }

    const nowStr = toCatalystDateTime(new Date());

    await ReturnRequestsRepo.update(req, {
      ROWID: rr.ROWID,
      tenant_id: tenantId,
      status: "rejected",
      status_reason: payload.status_reason ? String(payload.status_reason) : rr.status_reason ?? null,
      notes_internal: payload.notes_internal != null ? String(payload.notes_internal) : rr.notes_internal ?? null,
      resolved_at: nowStr, // treat rejected as terminal
    });

    await AuditEventsRepo.log(req, {
      tenant_id: tenantId,
      actor_type: "merchant",
      actor_id: actorId(req),
      action: "return_rejected",
      entity: "return_requests",
      entity_id: String(rr.ROWID),
      request_id: req.requestId || null,
      ip: req.ip || null,
      user_agent: req.headers?.["user-agent"] || null,
      details_json: JSON.stringify({
        return_number: rr.return_number,
        order_number: rr.order_number,
        status_reason: payload.status_reason ?? null,
        notes_internal: payload.notes_internal ?? null,
      }),
      created_at: nowStr,
    });

    const rr2 = await ReturnRequestsRepo.findByReturnNumber(req, tenantId, returnNumber);
    return { rr: rr2 ?? rr };
  }

  /**
   * ✅ Mark received
   */
  static async markReceived(
    req: any,
    tenantIdRaw: string | number,
    returnNumber: string,
    payload: { status_reason?: string; notes_internal?: string }
  ) {
    const tenantId = String(tenantIdRaw || "");
    if (!tenantId) throw new AppError(400, "tenantId missing", "TENANT_REQUIRED");

    const rr = await ReturnRequestsRepo.findByReturnNumber(req, tenantId, returnNumber);
    if (!rr) throw new AppError(404, "Return not found", "RETURN_NOT_FOUND");

    const status = normStatus(rr.status);
    if (status !== "approved") {
      throw new AppError(400, "Return cannot be marked received at this stage", "RETURN_RECEIVE_NOT_ALLOWED", {
        status: rr.status,
      });
    }

    const nowStr = toCatalystDateTime(new Date());

    await ReturnRequestsRepo.update(req, {
      ROWID: rr.ROWID,
      tenant_id: tenantId,
      status: "received",
      status_reason: payload.status_reason ? String(payload.status_reason) : rr.status_reason ?? null,
      received_at: nowStr,
      notes_internal: payload.notes_internal != null ? String(payload.notes_internal) : rr.notes_internal ?? null,
    });

    await AuditEventsRepo.log(req, {
      tenant_id: tenantId,
      actor_type: "merchant",
      actor_id: actorId(req),
      action: "return_received",
      entity: "return_requests",
      entity_id: String(rr.ROWID),
      request_id: req.requestId || null,
      ip: req.ip || null,
      user_agent: req.headers?.["user-agent"] || null,
      details_json: JSON.stringify({
        return_number: rr.return_number,
        order_number: rr.order_number,
        status_reason: payload.status_reason ?? null,
        notes_internal: payload.notes_internal ?? null,
      }),
      created_at: nowStr,
    });

    const rr2 = await ReturnRequestsRepo.findByReturnNumber(req, tenantId, returnNumber);
    return { rr: rr2 ?? rr };
  }

  /**
   * ✅ Resolve return (refund/exchange/store_credit)
   */
  static async resolve(
    req: any,
    tenantIdRaw: string | number,
    returnNumber: string,
    payload: {
      type: "refund" | "exchange" | "store_credit";
      status_reason?: string;
      notes_internal?: string;
      refund_transaction_id_external?: string;
      exchange_order_id_external?: string;
      store_credit_ref_external?: string;
    }
  ) {
    const tenantId = String(tenantIdRaw || "");
    if (!tenantId) throw new AppError(400, "tenantId missing", "TENANT_REQUIRED");

    const rr = await ReturnRequestsRepo.findByReturnNumber(req, tenantId, returnNumber);
    if (!rr) throw new AppError(404, "Return not found", "RETURN_NOT_FOUND");

    const status = normStatus(rr.status);
    if (!(status === "received" || status === "approved")) {
      throw new AppError(400, "Return cannot be resolved at this stage", "RETURN_RESOLVE_NOT_ALLOWED", {
        status: rr.status,
      });
    }

    const nowStr = toCatalystDateTime(new Date());

    await ReturnRequestsRepo.update(req, {
      ROWID: rr.ROWID,
      tenant_id: tenantId,
      status: "resolved",
      status_reason: payload.status_reason ? String(payload.status_reason) : rr.status_reason ?? null,
      notes_internal: payload.notes_internal != null ? String(payload.notes_internal) : rr.notes_internal ?? null,
      resolved_at: nowStr,

      exchange_order_id_external:
        payload.exchange_order_id_external != null
          ? String(payload.exchange_order_id_external)
          : rr.exchange_order_id_external ?? null,

      refund_transaction_id_external:
        payload.refund_transaction_id_external != null
          ? String(payload.refund_transaction_id_external)
          : rr.refund_transaction_id_external ?? null,

      store_credit_ref_external:
        payload.store_credit_ref_external != null
          ? String(payload.store_credit_ref_external)
          : rr.store_credit_ref_external ?? null,
    });

    await AuditEventsRepo.log(req, {
      tenant_id: tenantId,
      actor_type: "merchant",
      actor_id: actorId(req),
      action: "return_resolved",
      entity: "return_requests",
      entity_id: String(rr.ROWID),
      request_id: req.requestId || null,
      ip: req.ip || null,
      user_agent: req.headers?.["user-agent"] || null,
      details_json: JSON.stringify({
        return_number: rr.return_number,
        order_number: rr.order_number,
        resolution_type: payload.type,
        status_reason: payload.status_reason ?? null,
        notes_internal: payload.notes_internal ?? null,
        exchange_order_id_external: payload.exchange_order_id_external ?? null,
        refund_transaction_id_external: payload.refund_transaction_id_external ?? null,
        store_credit_ref_external: payload.store_credit_ref_external ?? null,
      }),
      created_at: nowStr,
    });

    const rr2 = await ReturnRequestsRepo.findByReturnNumber(req, tenantId, returnNumber);
    return { rr: rr2 ?? rr };
  }

  // ---------------------------
  // Backwards compatible methods
  // ---------------------------

  static async approveReturn(req: any, args: { tenantId: string; returnNumber: string; status_reason?: string }) {
    const out = await this.approve(req, args.tenantId, args.returnNumber, { status_reason: args.status_reason });
    return { ok: true, return_number: out.rr.return_number, status: "approved", approved_at: out.rr.approved_at };
  }

  static async receiveReturn(req: any, args: { tenantId: string; returnNumber: string; status_reason?: string }) {
    const out = await this.markReceived(req, args.tenantId, args.returnNumber, { status_reason: args.status_reason });
    return { ok: true, return_number: out.rr.return_number, status: "received", received_at: out.rr.received_at };
  }

  static async resolveReturn(req: any, args: {
    tenantId: string;
    returnNumber: string;
    status_reason?: string;
    items?: Array<{ return_item_id: string; decision: string; decision_reason?: string }>;
    exchange_order_id_external?: string;
    refund_transaction_id_external?: string;
    store_credit_ref_external?: string;
  }) {
    // keep existing signature but map into resolve()
    const out = await this.resolve(req, args.tenantId, args.returnNumber, {
      type: args.exchange_order_id_external ? "exchange" : args.refund_transaction_id_external ? "refund" : "store_credit",
      status_reason: args.status_reason,
      exchange_order_id_external: args.exchange_order_id_external,
      refund_transaction_id_external: args.refund_transaction_id_external,
      store_credit_ref_external: args.store_credit_ref_external,
    });

    return {
      ok: true,
      return_number: out.rr.return_number,
      status: "resolved",
      resolved_at: out.rr.resolved_at,
    };
  }
}
