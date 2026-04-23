import { z } from "zod";

export const LoanSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().positive(),
  due_day: z.number().int().min(1).max(31),
  start_date: z.string().optional(),
  end_date: z.string().nullable().optional(),
  category: z.string().default("LOANS/CC"),
  status: z.enum(["active", "inactive"]).default("active"),
  comments: z.string().max(500).nullable().optional(),
});

export type LoanInput = z.infer<typeof LoanSchema>;
