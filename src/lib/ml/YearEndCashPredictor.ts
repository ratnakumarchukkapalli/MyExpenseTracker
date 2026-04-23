/**
 * YearEndCashPredictor — pure JavaScript Monte Carlo simulation.
 *
 * Runs 2000 Box-Muller Monte Carlo iterations locally (no Python API required).
 * Output shape is identical to the Electron version so callers are unchanged.
 */

function formatToLakhs(amount: number): string {
  const lakhs = amount / 100000;
  return `₹${lakhs.toFixed(1)}L`;
}

/** Box-Muller transform — returns a standard-normal random variable */
function randNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

class YearEndCashPredictor {
  simulations: number;
  marketVolatility: number;
  expectedMarketReturn: number;

  constructor() {
    this.simulations = 2000;
    this.marketVolatility = 0.15;
    this.expectedMarketReturn = 0.12;
  }

  formatToLakhs(amount: number): string {
    return formatToLakhs(amount);
  }

  createSalarySchedule(baseSalary = 171000, hikedSalary = 190000, hikeMonth = 3): number[] {
    return Array(12).fill(0).map((_, i) => {
      const month = i + 1;
      return month >= hikeMonth ? hikedSalary : baseSalary;
    });
  }

  createSIPSchedule(baseSIP = 15000, increasedSIP = 18000, increaseMonth = 6): number[] {
    return Array(12).fill(0).map((_, i) => {
      const month = i + 1;
      return month >= increaseMonth ? increasedSIP : baseSIP;
    });
  }

  async runSimulation(params: {
    currentBankBalance: number;
    currentSIPValue?: number;
    currentShareValue?: number;
    salarySchedule?: number[];
    sipSchedule?: number[];
    avgMonthlyExpenses: number;
    expenseStdDev: number;
    oneTimeExpenses?: Array<{ month: number; amount: number }>;
    recurringExpenses?: Array<{ amount: number }>;
    oneTimeIncomes?: Array<{ month: number; amount: number }>;
    remainingMonths?: number;
    currentMonth?: number;
    currentYear?: number;
  }): Promise<any> {
    console.log('Starting Monte Carlo (JS), ', this.simulations, 'iterations...');

    const {
      currentBankBalance,
      currentSIPValue = 0,
      currentShareValue = 0,
      salarySchedule = [],
      sipSchedule = [],
      avgMonthlyExpenses,
      expenseStdDev,
      oneTimeExpenses = [],
      recurringExpenses = [],
      oneTimeIncomes = [],
      remainingMonths = 12,
      currentMonth = 1,
      currentYear = new Date().getFullYear(),
    } = params;

    const monthlyReturnMean = this.expectedMarketReturn / 12;
    const monthlyReturnStd = this.marketVolatility / Math.sqrt(12);

    // Each simulation returns a final total cash-equivalent value
    const finalValues: number[] = [];
    // Accumulate monthly percentile sums for projections
    const monthlyAccum: number[][] = Array(remainingMonths).fill(null).map(() => []);

    for (let sim = 0; sim < this.simulations; sim++) {
      let bank = currentBankBalance;
      let sipVal = currentSIPValue;
      let shareVal = currentShareValue;

      for (let m = 0; m < remainingMonths; m++) {
        const absMonth = currentMonth + m;
        const salaryIdx = (absMonth - 1) % 12;

        // Income
        const salary = salarySchedule[salaryIdx] ?? 0;
        const sipContrib = sipSchedule[salaryIdx] ?? 0;

        // Random expense draw
        const expenseNoise = expenseStdDev > 0 ? randNormal() * expenseStdDev : 0;
        let expense = Math.max(0, avgMonthlyExpenses + expenseNoise);

        // Recurring extras
        expense += recurringExpenses.reduce((s, r) => s + (r.amount || 0), 0);

        // One-time expenses/incomes for this simulated month
        const oMonth = currentMonth + m;
        oneTimeExpenses.forEach(oe => {
          if (oe.month === oMonth) expense += oe.amount;
        });
        let extraIncome = 0;
        oneTimeIncomes.forEach(oi => {
          if (oi.month === oMonth) extraIncome += oi.amount;
        });

        // Market returns
        const marketReturn = monthlyReturnMean + randNormal() * monthlyReturnStd;
        sipVal = sipVal * (1 + marketReturn) + sipContrib;
        shareVal = shareVal * (1 + marketReturn);

        // Bank: salary - expense - SIP contribution + extra income
        bank = bank + salary - expense - sipContrib + extraIncome;

        const total = bank + sipVal + shareVal;
        monthlyAccum[m].push(total);
      }

      const finalTotal = bank + sipVal + shareVal;
      finalValues.push(finalTotal);
    }

    // Sort final values for percentiles
    finalValues.sort((a, b) => a - b);
    const pct = (p: number) => {
      const idx = Math.floor((p / 100) * finalValues.length);
      return Math.round(finalValues[Math.min(idx, finalValues.length - 1)]);
    };

    const p10 = pct(10), p25 = pct(25), p50 = pct(50), p75 = pct(75), p90 = pct(90);
    const mean = Math.round(finalValues.reduce((a, b) => a + b, 0) / finalValues.length);

    // Monthly projections using median of each month's sims
    const monthlyProjections = monthlyAccum.map((vals, i) => {
      const sorted = [...vals].sort((a, b) => a - b);
      const mp50 = Math.round(sorted[Math.floor(sorted.length / 2)]);
      const mp10 = Math.round(sorted[Math.floor(sorted.length * 0.1)]);
      const mp90 = Math.round(sorted[Math.floor(sorted.length * 0.9)]);
      const month = currentMonth + i;
      return { month, p10: mp10, p50: mp50, p90: mp90 };
    });

    const yearEnd = {
      p10, p25, p50, p75, p90, mean,
      p10Formatted: formatToLakhs(p10),
      p25Formatted: formatToLakhs(p25),
      p50Formatted: formatToLakhs(p50),
      p75Formatted: formatToLakhs(p75),
      p90Formatted: formatToLakhs(p90),
      meanFormatted: formatToLakhs(mean),
    };

    // Sample path = p50 monthly values
    const samplePath = monthlyProjections.map(mp => ({
      month: mp.month,
      cashEquivalents: mp.p50,
      bankBalance: Math.round(mp.p50 * 0.6),
      sipValue: Math.round(mp.p50 * 0.25),
      shareValue: Math.round(mp.p50 * 0.15),
      expense: Math.round(avgMonthlyExpenses),
      salary: salarySchedule[(mp.month - 1) % 12] || 0,
    }));

    console.log('Monte Carlo complete (JS).');
    console.log(`  P10: ${yearEnd.p10Formatted}, P50: ${yearEnd.p50Formatted}, P90: ${yearEnd.p90Formatted}`);

    return {
      yearEnd,
      monthlyProjections,
      samplePath,
      inputs: {
        simulations: this.simulations,
        marketVolatility: this.marketVolatility,
        expectedReturn: this.expectedMarketReturn,
        ...params,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  getMethodologyExplanation() {
    return {
      title: 'Monte Carlo Simulation Explained',
      description: `Monte Carlo simulation runs ${this.simulations.toLocaleString()} random scenarios to predict your year-end cash equivalents.`,
      steps: [
        'Each month, we simulate random variations in your expenses (based on your spending patterns)',
        'Share values fluctuate with random market returns (±15% annual volatility)',
        'SIP investments grow with contributions plus expected returns',
        'One-time expenses (like your wedding) are deducted in the specified month',
        'We collect all simulation results and calculate percentiles',
      ],
      interpretation: {
        p10: "Conservative estimate - 90% chance you'll do better than this",
        p50: 'Most likely outcome - median of all simulations',
        p90: 'Optimistic estimate - only 10% chance of exceeding this',
      },
    };
  }
}

export default YearEndCashPredictor;
