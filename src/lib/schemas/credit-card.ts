import { z } from "zod";

export const CreditCardSchema = z.object({
  name: z.string().min(1).max(200),
  credit_limit: z.number().nonnegative().nullable().optional(),
  current_balance: z.number().nonnegative().default(0),
});

export const CreditCardUpdateSchema = CreditCardSchema.partial();

export const CreditCardPaySchema = z.object({
  amount: z.number().positive(),
  bank_account_id: z.number().int().positive().nullable().optional(),
});

export type CreditCardInput = z.infer<typeof CreditCardSchema>;
