import { z } from "zod";

const Allocation = z.discriminatedUnion("destination", [
  z.object({
    destination:     z.literal("bank"),
    bank_account_id: z.number().int().positive(),
    amount:          z.number().positive(),
  }),
  z.object({
    destination: z.literal("sip"),
    sip_fund_id: z.number().int().positive(),
    amount:      z.number().positive(),
  }),
]);

export type StockSaleAllocationInput = z.infer<typeof Allocation>;

export const StockSaleSchema = z
  .object({
    holding_id:  z.number().int().positive(),
    shares_sold: z.number().positive(),
    sell_price:  z.number().positive(),
    sell_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    charges:     z.number().min(0).default(0),
    broker:      z.string().max(100).optional().nullable(),
    notes:       z.string().max(500).optional().nullable(),
    allocations: z.array(Allocation).min(1),
  })
  // Every rupee of net proceeds has to land somewhere. If allocations undershoot,
  // net worth silently drops by the shortfall; if they overshoot, it inflates.
  // 0.01 tolerance absorbs float noise from the client's own arithmetic only.
  .refine(
    (v) =>
      Math.abs(
        v.allocations.reduce((s, a) => s + a.amount, 0) -
          (v.shares_sold * v.sell_price - v.charges)
      ) < 0.01,
    { message: "Allocations must sum to net proceeds", path: ["allocations"] }
  )
  .refine((v) => v.shares_sold * v.sell_price - v.charges > 0, {
    message: "Charges cannot exceed gross proceeds",
    path: ["charges"],
  });

export type StockSaleInput = z.infer<typeof StockSaleSchema>;
