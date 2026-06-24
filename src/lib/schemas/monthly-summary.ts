import { z } from "zod";

export const MonthlySummaryUpdateSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  salary: z.number().min(0).default(0),
  previous_month_remaining: z.number().default(0),
  interest_income: z.number().min(0).default(0),
  savings_fd: z.number().min(0).default(0),
  savings_sip: z.number().min(0).default(0),
  savings_shares: z.number().min(0).default(0),
  savings_nps: z.number().min(0).default(0),
  savings_pf: z.number().min(0).default(0),
  sodexo_balance: z.number().min(0).default(0),
  sodexo_credit: z.number().min(0).default(0),
});

export type MonthlySummaryUpdate = z.infer<typeof MonthlySummaryUpdateSchema>;
