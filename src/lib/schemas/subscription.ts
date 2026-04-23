import { z } from "zod";

export const SubscriptionSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().positive(),
  renewal_date: z.string().nullable().optional(),
  yearly_cost: z.number().min(0).nullable().optional(),
  billing_type: z.enum(["monthly", "yearly", "quarterly"]).default("yearly"),
  status: z.enum(["active", "inactive", "cancelled"]).default("active"),
  comments: z.string().max(500).nullable().optional(),
  category: z.string().default("Other"),
  last_paid_date: z.string().nullable().optional(),
});

export type SubscriptionInput = z.infer<typeof SubscriptionSchema>;
