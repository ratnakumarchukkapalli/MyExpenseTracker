import { z } from "zod";

export const BankAccountSchema = z.object({
  name: z.string().min(1).max(200),
  current_balance: z.number().default(0),
});

export const BankAccountUpdateSchema = BankAccountSchema.partial();

export const BankAccountTransferSchema = z
  .object({
    from_account_id: z.number().int().positive(),
    to_account_id: z.number().int().positive(),
    amount: z.number().positive(),
  })
  .refine((data) => data.from_account_id !== data.to_account_id, {
    message: "Source and destination accounts must be different",
    path: ["to_account_id"],
  });

export type BankAccountInput = z.infer<typeof BankAccountSchema>;
