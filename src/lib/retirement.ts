export const RETIREMENT_DEFAULTS = {
  target_age: 45,
  life_expectancy_age: 85,
  pre_return_rate: 0.12,
  post_return_rate: 0.08,
  inflation_rate: 0.06,
  salary_growth_rate: 0.10,
  annual_bonus_pct: 0.10,
};

export type RetirementAssumptions = {
  birth_year: number;
  target_age: number;
  life_expectancy_age: number;
  pre_return_rate: number;
  post_return_rate: number;
  inflation_rate: number;
  salary_growth_rate: number;
  annual_bonus_pct: number;
  withdrawal_start_age?: number | null;
};

export type LoanEndDate = {
  amount: number;
  end_date: string;
};

export type RetirementMilestoneInput = {
  target_year: number;
  amount: number;
};

export type RetirementProjectionInput = {
  assumptions: RetirementAssumptions;
  currentCorpus: number;
  currentAnnualSalary: number;
  monthlySurplus: number;
  currentAnnualExpenses: number;
  loanEndDates: LoanEndDate[];
  milestones: RetirementMilestoneInput[];
  asOfDate?: Date;
};

export type YearProjectionRow = { age: number; year: number; corpus: number; phase: 'accumulation' | 'withdrawal' };

export type RetirementProjectionResult = {
  rows: YearProjectionRow[];
  corpusAtTargetAge: number;
  checkpointThreshold: number;
  checkpointPassed: boolean;
  finalCorpus: number;
  depletionAge: number | null;
};

export function projectRetirement(input: RetirementProjectionInput): RetirementProjectionResult {
  const { assumptions, currentCorpus, currentAnnualSalary, monthlySurplus, currentAnnualExpenses, loanEndDates, milestones } = input;
  const asOf = input.asOfDate ?? new Date();
  const currentYear = asOf.getFullYear();
  const currentAge = currentYear - assumptions.birth_year;
  const withdrawalStartAge = assumptions.withdrawal_start_age ?? null;

  const loanEndYears = loanEndDates
    .filter((l) => l.end_date)
    .map((l) => ({ amount: l.amount, year: new Date(`${l.end_date}T00:00:00`).getFullYear() }));

  const rows: YearProjectionRow[] = [{
    age: currentAge,
    year: currentYear,
    corpus: currentCorpus,
    phase: withdrawalStartAge != null && currentAge >= withdrawalStartAge ? 'withdrawal' : 'accumulation',
  }];

  let corpus = currentCorpus;
  let freedUpMonthly = 0;
  let depletionAge: number | null = null;
  const yearsToProject = Math.max(0, assumptions.life_expectancy_age - currentAge);

  for (let i = 1; i <= yearsToProject; i++) {
    const age = currentAge + i;
    const year = currentYear + i;
    const isWithdrawal = withdrawalStartAge != null && age >= withdrawalStartAge;

    freedUpMonthly += loanEndYears
      .filter((l) => l.year === year - 1)
      .reduce((sum, l) => sum + l.amount, 0);

    const milestoneCost = milestones
      .filter((m) => m.target_year === year)
      .reduce((sum, m) => sum + m.amount * Math.pow(1 + assumptions.inflation_rate, year - currentYear), 0);

    if (isWithdrawal) {
      const annualExpensesThisYear = Math.max(
        0,
        currentAnnualExpenses * Math.pow(1 + assumptions.inflation_rate, i) - freedUpMonthly * 12
      );
      corpus = corpus * (1 + assumptions.post_return_rate) - annualExpensesThisYear - milestoneCost;
    } else {
      const growthFactor = Math.pow(1 + assumptions.salary_growth_rate, i);
      const monthlySurplusThisYear = monthlySurplus * growthFactor + freedUpMonthly;
      const annualSalaryThisYear = currentAnnualSalary * growthFactor;
      const annualBonus = assumptions.annual_bonus_pct * annualSalaryThisYear;
      const annualContribution = monthlySurplusThisYear * 12 + annualBonus;

      corpus = corpus * (1 + assumptions.pre_return_rate) + annualContribution - milestoneCost;
    }

    if (corpus <= 0 && depletionAge === null) {
      depletionAge = age;
    }
    corpus = Math.max(0, corpus);

    rows.push({ age, year, corpus: Math.round(corpus), phase: isWithdrawal ? 'withdrawal' : 'accumulation' });
  }

  const targetRow = rows.find((r) => r.age === assumptions.target_age) ?? rows[rows.length - 1];
  const checkpointThreshold = Math.round(25 * currentAnnualExpenses);

  return {
    rows,
    corpusAtTargetAge: targetRow.corpus,
    checkpointThreshold,
    checkpointPassed: targetRow.corpus >= checkpointThreshold,
    finalCorpus: rows[rows.length - 1].corpus,
    depletionAge,
  };
}
