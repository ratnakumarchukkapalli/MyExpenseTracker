import { z } from "zod";

export const LoanSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().positive(),
  due_day: z.number().int().min(1).max(31),
  start_date: z.string().optional(),
  end_date: z.string().nullable().optional(),
  category: z.string().default("LOANS/CC"),
  status: z.enum(["active", "completed", "paused", "inactive"]).default("active"),
  comments: z.string().max(500).nullable().optional(),
  remind_me: z.boolean().default(false),
  outstanding_balance: z.number().nonnegative().nullable().optional(),
  outstanding_balance_asof: z.string().nullable().optional(),
  bank_account_id: z.number().int().positive().nullable().optional(),
});

export type LoanInput = z.infer<typeof LoanSchema>;
