import { z } from "zod";

/**
 * Merchant action: approve a return
 * - optional note/reason
 */
export const approveReturnSchema = z.object({
  status_reason: z.string().max(500).optional(),
});

/**
 * Merchant action: mark return received
 */
export const receiveReturnSchema = z.object({
  status_reason: z.string().max(500).optional(),
});

/**
 * Per-item decision update
 */
export const merchantItemDecisionSchema = z.object({
  return_item_id: z.string().regex(/^\d+$/, "return_item_id must be digits"),
  decision: z.enum(["approved", "rejected", "pending"]),
  decision_reason: z.string().max(500).optional(),
});

/**
 * Merchant action: resolve return
 * - optionally set per-item decisions
 * - optionally attach external references for exchange/refund/credit
 */
export const resolveReturnSchema = z.object({
  status_reason: z.string().max(500).optional(),

  // optional per-item decisions in same call
  items: z.array(merchantItemDecisionSchema).optional().default([]),

  // optional external references
  exchange_order_id_external: z.string().max(120).optional(),
  refund_transaction_id_external: z.string().max(120).optional(),
  store_credit_ref_external: z.string().max(120).optional(),
});

export type ApproveReturnInput = z.infer<typeof approveReturnSchema>;
export type ReceiveReturnInput = z.infer<typeof receiveReturnSchema>;
export type ResolveReturnInput = z.infer<typeof resolveReturnSchema>;
export type MerchantItemDecisionInput = z.infer<typeof merchantItemDecisionSchema>;
