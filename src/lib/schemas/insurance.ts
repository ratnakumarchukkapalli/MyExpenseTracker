import { z } from "zod";

export const InsuranceSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  type: z.string().min(1).max(100),
  insurer: z.string().min(1).max(200),
  policy_number: z.string().max(100).nullable().optional(),
  sum_insured: z.number().min(0).default(0),
  premium_amount: z.number().positive(),
  premium_mode: z
    .enum(["monthly", "quarterly", "yearly", "biennial", "single"])
    .default("yearly"),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  next_due_date: z.string().nullable().optional(),
  nominee: z.string().max(200).nullable().optional(),
  vehicle_reg: z.string().max(50).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  owner: z.string().max(100).default("self"),
});

export type InsuranceInput = z.infer<typeof InsuranceSchema>;
