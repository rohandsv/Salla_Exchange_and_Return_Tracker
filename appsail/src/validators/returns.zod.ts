import { z } from "zod";

/**
 * Items user selects for return/exchange
 */
export const returnItemSchema = z.object({
  order_item_id_external: z.string().min(1).optional(),
  sku: z.string().min(1),
  product_name: z.string().min(1).optional(),
  variant_name: z.string().min(1).optional(),
  category_id_external: z.string().min(1).optional(),

  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative().optional(),

  reason_code: z.string().min(1),
  reason_note: z.string().max(1000).optional(),
});

/**
 * Create return request from portal (protected)
 */
export const createReturnSchema = z.object({
  requested_resolution: z.string().min(1), // e.g. "refund" | "exchange" | "store_credit" (you store as string)
  notes_customer: z.string().max(2000).optional(),

  order_id_external: z.string().min(1).optional(),
  policy_snapshot_json: z.string().optional(),

  is_warranty: z.boolean(),

  items: z.array(returnItemSchema).min(1),
});

/**
 * Return number param
 */
export const returnNumberParamSchema = z.object({
  return_number: z.string().min(1),
});

/**
 * Cancel a return (only while status === "requested")
 */
export const cancelReturnSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type CancelReturnInput = z.infer<typeof cancelReturnSchema>;
