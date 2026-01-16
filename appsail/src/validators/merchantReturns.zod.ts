import { z } from "zod";

/**
 * Route param
 */
export const returnNumberParamSchema = z.object({
  return_number: z.string().min(1),
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
 * Set items
 */
export const setItemsSchema = z.object({
  items: z.array(merchantItemDecisionSchema).min(1),
});

/**
 * Merchant action: approve a return
 */
export const approveReturnSchema = z.object({
  status_reason: z.string().max(500).optional(),
  notes_internal: z.string().max(2000).optional(),
  items: z.array(merchantItemDecisionSchema).optional(),
});

/**
 * Merchant action: reject a return
 */
export const rejectReturnSchema = z.object({
  status_reason: z.string().max(500).optional(),
  notes_internal: z.string().max(2000).optional(),
});

/**
 * Merchant action: mark return received
 */
export const receiveReturnSchema = z.object({
  status_reason: z.string().max(500).optional(),
  notes_internal: z.string().max(2000).optional(),
});

/**
 * Merchant action: resolve return
 */
export const resolveReturnSchema = z
  .object({
    type: z.enum(["refund", "exchange", "store_credit"]),
    status_reason: z.string().max(500).optional(),
    notes_internal: z.string().max(2000).optional(),

    // optional per-item decisions in same call
    items: z.array(merchantItemDecisionSchema).optional().default([]),

    // external refs (conditionally required by type)
    exchange_order_id_external: z.string().max(120).optional(),
    refund_transaction_id_external: z.string().max(120).optional(),
    store_credit_ref_external: z.string().max(120).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === "refund" && !val.refund_transaction_id_external) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["refund_transaction_id_external"],
        message: "refund_transaction_id_external is required when type=refund",
      });
    }
    if (val.type === "exchange" && !val.exchange_order_id_external) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exchange_order_id_external"],
        message: "exchange_order_id_external is required when type=exchange",
      });
    }
    if (val.type === "store_credit" && !val.store_credit_ref_external) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["store_credit_ref_external"],
        message: "store_credit_ref_external is required when type=store_credit",
      });
    }
  });

export type ApproveReturnInput = z.infer<typeof approveReturnSchema>;
export type RejectReturnInput = z.infer<typeof rejectReturnSchema>;
export type ReceiveReturnInput = z.infer<typeof receiveReturnSchema>;
export type ResolveReturnInput = z.infer<typeof resolveReturnSchema>;
export type MerchantItemDecisionInput = z.infer<typeof merchantItemDecisionSchema>;
export type SetItemsInput = z.infer<typeof setItemsSchema>;
