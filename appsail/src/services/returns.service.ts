import crypto from "crypto";
import { AppError } from "../lib/errors";
import { toCatalystDateTime } from "../lib/datetime";
import { ReturnRequestsRepo } from "../repositories/returnRequests.repo";
import { ReturnItemsRepo } from "../repositories/returnItems.repo";
import { AuditEventsRepo } from "../repositories/auditEvents.repo";

function generateReturnNumber(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `RMA-${y}${m}${day}-${rand}`;
}

function assertRowIdDigits(id: string | number) {
    const v = String(id);
    if (!/^\d+$/.test(v)) throw new Error("ROWID/FK must be digits");
    return v;
}

export class ReturnsService {
    static async createPortalReturn(
        req: any,
        payload: {
            requested_resolution: string;
            notes_customer?: string;
            order_id_external?: string;
            policy_snapshot_json?: string;
            is_warranty: boolean;
            items: Array<{
                order_item_id_external?: string;
                sku: string;
                product_name?: string;
                variant_name?: string;
                category_id_external?: string;
                quantity: number;
                unit_price?: number;
                reason_code: string;
                reason_note?: string;
            }>;
        }
    ) {
        const tenantId = assertRowIdDigits(req.tenantId);
        const portalSession = req.portalSession;

        if (!portalSession?.order_number || !portalSession?.contact_hash) {
            throw new AppError(401, "Unauthorized", "PORTAL_UNAUTHORIZED");
        }

        const orderNumber = String(portalSession.order_number);
        const contactHash = String(portalSession.contact_hash);

        // Totals
        const totalItemsCount = payload.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
        const totalRequestValue = payload.items.reduce((sum, it) => {
            const price = typeof it.unit_price === "number" ? it.unit_price : 0;
            return sum + price * (it.quantity || 0);
        }, 0);

        // Generate unique return_number (retry on collision)
        let returnNumber = generateReturnNumber();
        for (let i = 0; i < 3; i++) {
            const exists = await ReturnRequestsRepo.findByReturnNumber(req, tenantId, returnNumber);
            if (!exists) break;
            returnNumber = generateReturnNumber();
        }

        const nowStr = toCatalystDateTime(new Date());

        // 1) Insert return_requests
        let insertedRequest: any;
        try {
            insertedRequest = await ReturnRequestsRepo.insert(req, {
                tenant_id: tenantId,
                return_number: returnNumber,
                order_number: orderNumber,
                order_id_external: payload.order_id_external ?? null,

                customer_contact_masked: null,
                customer_contact_hash: contactHash,

                requested_resolution: payload.requested_resolution,
                status: "requested",
                status_reason: null,

                requested_at: nowStr,
                approved_at: null,
                received_at: null,
                resolved_at: null,

                policy_snapshot_json: payload.policy_snapshot_json ?? null,
                notes_internal: null,
                notes_customer: payload.notes_customer ?? null,

                total_items_count: totalItemsCount,
                total_request_value: totalRequestValue,

                exchange_order_id_external: null,
                refund_transaction_id_external: null,
                store_credit_ref_external: null,

                is_warranty: payload.is_warranty,
                customer_cancelled_at: null,
            });
        } catch (e: any) {
            throw new AppError(500, "Failed to create return request", "RETURN_CREATE_FAILED", e?.message);
        }

        const returnRequestId = assertRowIdDigits(
            insertedRequest?.ROWID ?? insertedRequest?.rowid ?? insertedRequest?.ROW_ID
        );

        // 2) Insert return_items
        try {
            const itemRows = payload.items.map((it) => ({
                tenant_id: tenantId,
                return_request_id: returnRequestId,

                order_item_id_external: it.order_item_id_external ?? null,
                sku: it.sku,
                product_name: it.product_name ?? null,
                variant_name: it.variant_name ?? null,
                category_id_external: it.category_id_external ?? null,

                quantity: it.quantity,
                unit_price: typeof it.unit_price === "number" ? it.unit_price : null,

                reason_code: it.reason_code,
                reason_note: it.reason_note ?? null,

                decision: "pending",
                decision_reason: null,
            }));

            await ReturnItemsRepo.bulkInsert(req, itemRows, 5);
        } catch (e: any) {
            // Best-effort rollback
            try {
                await ReturnItemsRepo.deleteByReturnRequestId(req, tenantId, returnRequestId);
                await ReturnRequestsRepo.deleteById(req, returnRequestId);
            } catch {
                // ignore rollback errors
            }
            throw new AppError(500, "Failed to create return items", "RETURN_ITEMS_CREATE_FAILED", e?.message);
        }

        // 3) Audit (best-effort)
        await AuditEventsRepo.log(req, {
            tenant_id: tenantId,
            actor_type: "portal",
            actor_id: String(portalSession?.ROWID ?? ""),
            action: "return_requested",
            entity: "return_requests",
            entity_id: String(returnRequestId),
            request_id: req.requestId || null,
            ip: req.ip || null,
            user_agent: req.headers?.["user-agent"] || null,
            details_json: JSON.stringify({
                return_number: returnNumber,
                order_number: orderNumber,
                total_items_count: totalItemsCount,
                total_request_value: totalRequestValue,
            }),
            created_at: nowStr,
        });

        return {
            ok: true,
            return_request_id: returnRequestId,
            return_number: returnNumber,
            status: "requested",
            requested_at: nowStr,
            total_items_count: totalItemsCount,
            total_request_value: totalRequestValue,
        };
    }

    static async listPortalReturns(req: any) {
        const tenantId = String(req.tenantId || "");
        const portalSession = req.portalSession;

        if (!tenantId || !portalSession?.order_number) {
            throw new AppError(401, "Unauthorized", "PORTAL_UNAUTHORIZED");
        }

        const orderNumber = String(portalSession.order_number);

        const rows = await ReturnRequestsRepo.listByOrderNumber(req, tenantId, orderNumber);

        return {
            ok: true,
            order_number: orderNumber,
            returns: rows.map((r) => ({
                return_number: r.return_number,
                status: r.status,
                status_reason: r.status_reason ?? null,
                requested_at: r.requested_at,
                resolved_at: r.resolved_at ?? null,
                total_items_count: Number(r.total_items_count ?? 0),
                total_request_value: r.total_request_value == null ? null : Number(r.total_request_value),
                is_warranty: Boolean(r.is_warranty),
            })),
        };
    }

    static async getPortalReturnDetails(req: any, args: { returnNumber: string }) {
        const tenantId = String(req.tenantId || "");
        const portalSession = req.portalSession;

        if (!tenantId || !portalSession?.order_number) {
            throw new AppError(401, "Unauthorized", "PORTAL_UNAUTHORIZED");
        }

        const orderNumber = String(portalSession.order_number);

        const rr = await ReturnRequestsRepo.findByReturnNumber(req, tenantId, args.returnNumber);
        if (!rr) throw new AppError(404, "Return not found", "RETURN_NOT_FOUND");

        // Ownership safety: return must match portal session order_number
        if (String(rr.order_number) !== orderNumber) {
            throw new AppError(404, "Return not found", "RETURN_NOT_FOUND");
        }

        const items = await ReturnItemsRepo.listByReturnRequestId(req, tenantId, rr.ROWID);

        return {
            ok: true,
            return: {
                return_number: rr.return_number,
                order_number: rr.order_number,
                order_id_external: rr.order_id_external ?? null,

                requested_resolution: rr.requested_resolution,
                status: rr.status,
                status_reason: rr.status_reason ?? null,

                requested_at: rr.requested_at,
                approved_at: rr.approved_at ?? null,
                received_at: rr.received_at ?? null,
                resolved_at: rr.resolved_at ?? null,

                notes_customer: rr.notes_customer ?? null,
                total_items_count: rr.total_items_count,
                total_request_value: rr.total_request_value ?? null,
                is_warranty: rr.is_warranty,

                items: items.map((it) => ({
                    sku: it.sku,
                    product_name: it.product_name ?? null,
                    variant_name: it.variant_name ?? null,
                    quantity: Number((it as any).quantity ?? 0),
                    unit_price: (it as any).unit_price == null ? null : Number((it as any).unit_price),
                    reason_code: it.reason_code,
                    reason_note: it.reason_note ?? null,
                    decision: it.decision,
                    decision_reason: it.decision_reason ?? null,
                })),
            },
        };
    }
}
