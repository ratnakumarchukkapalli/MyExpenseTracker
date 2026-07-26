import { z } from "zod";

export const RetirementPlanSchema = z.object({
  birth_year: z.number().int().min(1930).max(new Date().getFullYear()),
  target_age: z.number().int().min(1).max(100),
  life_expectancy_age: z.number().int().min(1).max(120),
  pre_return_rate: z.number().min(0).max(1),
  post_return_rate: z.number().min(0).max(1),
  inflation_rate: z.number().min(0).max(1),
  salary_growth_rate: z.number().min(0).max(1),
  annual_bonus_pct: z.number().min(0).max(1),
  monthly_surplus_override: z.number().nullable().optional(),
  annual_salary_override: z.number().nullable().optional(),
  withdrawal_start_age: z.number().int().min(1).max(120).nullable().optional(),
});

export const RetirementPlanUpdateSchema = RetirementPlanSchema.partial();

export const RetirementMilestoneSchema = z.object({
  label: z.string().min(1).max(200),
  target_year: z.number().int().min(1900).max(2200),
  amount: z.number().positive(),
});

export const RetirementMilestoneUpdateSchema = RetirementMilestoneSchema.partial();

export type RetirementPlanInput = z.infer<typeof RetirementPlanSchema>;
export type RetirementMilestoneInput = z.infer<typeof RetirementMilestoneSchema>;
