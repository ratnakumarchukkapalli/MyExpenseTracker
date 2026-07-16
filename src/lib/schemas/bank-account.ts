import { z } from "zod";

export const BankAccountSchema = z.object({
  name: z.string().min(1).max(200),
  current_balance: z.number().default(0),
});

export const BankAccountUpdateSchema = BankAccountSchema.partial();

export type BankAccountInput = z.infer<typeof BankAccountSchema>;
