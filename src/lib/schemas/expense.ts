import { z } from "zod";

const VALID_CATEGORIES = [
  "Personal",
  "HOME Purpose",
  "LOANS/CC",
  "Savings",
  "MonthlyBills",
] as const;

export const ExpenseCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  category: z.enum(VALID_CATEGORIES),
  note: z.string().max(1000).optional().nullable(),
  is_auto_generated: z.boolean().optional().default(false),
  source_type: z.enum(["loan", "subscription", "iphone"]).optional().nullable(),
  source_id: z.number().int().positive().optional().nullable(),
  iphone_import_id: z.string().uuid().optional().nullable(),
  payment_source: z.enum(["bank", "sodexo", "credit_card"]).default("bank").optional(),
  credit_card_id: z.number().int().positive().optional().nullable(),
  bank_account_id: z.number().int().positive().optional().nullable(),
  tag: z.string().max(60).trim().optional().nullable(),
});

export const ExpenseUpdateSchema = ExpenseCreateSchema.partial().required({
  date: true,
  description: true,
  amount: true,
  category: true,
});

export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;
export type ExpenseUpdate = z.infer<typeof ExpenseUpdateSchema>;
