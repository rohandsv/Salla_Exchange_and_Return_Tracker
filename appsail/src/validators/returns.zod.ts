import { z } from "zod";

export const returnItemSchema = z.object({
  order_item_id_external: z.string().min(1).optional(),
  sku: z.string().min(1),
  product_name: z.string().min(1).optional(),
  variant_name: z.string().min(1).optional(),
  category_id_external: z.string().min(1).optional(),

  quantity: z.number().int().min(1).default(1),
  unit_price: z.number().nonnegative().optional(),

  reason_code: z.string().min(1),
  reason_note: z.string().max(500).optional(),
});

export const createReturnSchema = z.object({
  requested_resolution: z.string().min(1),
  notes_customer: z.string().max(2000).optional(),

  order_id_external: z.string().min(1).optional(),
  policy_snapshot_json: z.string().optional(),

  is_warranty: z.boolean().default(false),

  items: z.array(returnItemSchema).min(1),
});

export const returnNumberParamSchema = z.object({
  return_number: z.string().min(6).max(50), // ex: RMA-20260109-9A38E4
});
