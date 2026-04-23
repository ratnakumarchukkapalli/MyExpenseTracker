/**
 * SpendingAnalyzer — statistical analysis of spending patterns.
 * Heavy math delegated to Python API with local fallback.
 */

import { EXPENSE_CATEGORIES } from '../../constants/categories';

async function mlAnalyze(endpoint: string, payload: unknown): Promise<any> {
  try {
    const res = await fetch(`http://127.0.0.1:8765/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('ML API error');
    return res.json();
  } catch {
    return null;
  }
}

class SpendingAnalyzer {
  categories: string[];

  constructor() {
    this.categories = [...EXPENSE_CATEGORIES];
  }


  async analyze(categoryData: Record<string, any[]>, predictions: any, targetMonth: number, targetYear: number) {
    const [monthOverMonth, anomalies] = await Promise.all([
      this.calculateMonthOverMonth(categoryData),
      this.detectAnomalies(categoryData),
    ]);

    return {
      summary: this.generateSummary(categoryData, predictions),
      topSpending: this.identifyTopSpending(categoryData),
      monthOverMonth,
      anomalies,
      recommendations: this.generateRecommendations(categoryData, predictions),
      savingsOpportunities: this.findSavingsOpportunities(categoryData, predictions),
      reportMonth: targetMonth,
      reportYear: targetYear,
      generatedAt: new Date().toISOString(),
    };
  }

  generateSummary(categoryData: Record<string, any[]>, predictions: any) {
    let totalSpentLast6Months = 0;
    let totalSavedLast6Months = 0;
    const monthlyAverages: Record<string, number> = {};
    const totalPredictedExpenses = predictions?.totalPredictedExpenses || 0;
    const predictedSavings = predictions?.predictedSavings || 0;
    let numExpenseMonths = 0;
    let numSavingsMonths = 0;

    for (const [category, data] of Object.entries(categoryData)) {
      const amounts = data.map((d: any) => d.amount);
      const total = amounts.reduce((a, b) => a + b, 0);
      if (category === 'Savings') {
        totalSavedLast6Months = total;
        numSavingsMonths = Math.max(numSavingsMonths, amounts.length);
        monthlyAverages[category] = amounts.length > 0 ? total / amounts.length : 0;
      } else {
        totalSpentLast6Months += total;
        numExpenseMonths = Math.max(numExpenseMonths, amounts.length);
        monthlyAverages[category] = amounts.length > 0 ? total / amounts.length : 0;
      }
    }

    const overallMonthlyAverage = totalSpentLast6Months / Math.max(numExpenseMonths, 1);
    const averageMonthlySavings = totalSavedLast6Months / Math.max(numSavingsMonths, 1);

    return {
      totalSpentLast6Months: Math.round(totalSpentLast6Months),
      totalSavedLast6Months: Math.round(totalSavedLast6Months),
      overallMonthlyAverage: Math.round(overallMonthlyAverage),
      averageMonthlySavings: Math.round(averageMonthlySavings),
      categoryAverages: Object.fromEntries(
        Object.entries(monthlyAverages).map(([k, v]) => [k, Math.round(v)])
      ),
      predictedNextMonth: Math.round(totalPredictedExpenses),
      predictedVsAverage:
        totalPredictedExpenses > 0
          ? ((totalPredictedExpenses - overallMonthlyAverage) / overallMonthlyAverage * 100).toFixed(1)
          : 0,
      predictedSavings: Math.round(predictedSavings),
      predictedSavingsVsAverage:
        predictedSavings > 0 && averageMonthlySavings > 0
          ? ((predictedSavings - averageMonthlySavings) / averageMonthlySavings * 100).toFixed(1)
          : 0,
    };
  }

  identifyTopSpending(categoryData: Record<string, any[]>) {
    const categoryTotals: any[] = [];
    for (const [category, data] of Object.entries(categoryData)) {
      if (category === 'Savings') continue;
      const total = data.reduce((sum, d) => sum + d.amount, 0);
      const average = data.length > 0 ? total / data.length : 0;
      const lastMonth = data.length > 0 ? data[data.length - 1].amount : 0;
      categoryTotals.push({ category, total: Math.round(total), average: Math.round(average), lastMonth: Math.round(lastMonth), percentage: 0 });
    }
    categoryTotals.sort((a, b) => b.total - a.total);
    const grandTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0);
    categoryTotals.forEach(c => {
      c.percentage = grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0;
    });
    return categoryTotals;
  }

  async calculateMonthOverMonth(categoryData: Record<string, any[]>) {
    const entries = Object.entries(categoryData);
    const results = await Promise.all(
      entries.map(async ([category, data]) => {
        if (data.length < 2) {
          return [category, { change: 0, percentChange: 0, trend: 'stable' }];
        }
        const sortedData = [...data].sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });
        const current = sortedData[sortedData.length - 1].amount;
        const previous = sortedData[sortedData.length - 2].amount;

        const res = await mlAnalyze('mom-change', { current, previous, category });
        const change = current - previous;
        if (res) {
          let trend = 'stable';
          if (res.pct_change > 10) trend = 'increasing';
          else if (res.pct_change < -10) trend = 'decreasing';
          return [category, { lastMonth: Math.round(current), previousMonth: Math.round(previous), change: Math.round(change), percentChange: res.pct_change, trend }];
        }
        // fallback
        const pct = previous > 0 ? parseFloat(((change / previous) * 100).toFixed(1)) : 0;
        let trend = 'stable';
        if (pct > 10) trend = 'increasing';
        else if (pct < -10) trend = 'decreasing';
        return [category, { lastMonth: Math.round(current), previousMonth: Math.round(previous), change: Math.round(change), percentChange: pct, trend }];
      })
    );
    return Object.fromEntries(results as [string, any][]);
  }

  async detectAnomalies(categoryData: Record<string, any[]>) {
    const anomalies: any[] = [];
    await Promise.all(
      Object.entries(categoryData).map(async ([category, data]) => {
        if (data.length < 3) return;
        const amounts = data.map((d: any) => d.amount);
        const labels = data.map((d: any) => `${d.year}-${String(d.month).padStart(2, '0')}`);

        const res = await mlAnalyze('anomalies', { values: amounts, labels });
        if (res) {
          const mean = res.mean;
          res.anomalies.forEach((item: any, idx: number) => {
            if (!item.is_anomaly) return;
            const d = data[idx];
            anomalies.push({ category, month: d.month, year: d.year, amount: Math.round(d.amount), expected: Math.round(mean), deviation: item.z_score > 0 ? 'high' : 'low', deviationPercent: ((d.amount - mean) / mean * 100).toFixed(1) });
          });
        } else {
          // local fallback
          const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
          const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
          const stdDev = Math.sqrt(variance);
          data.forEach((d: any) => {
            const z = stdDev > 0 ? (d.amount - mean) / stdDev : 0;
            if (Math.abs(z) > 2.0) {
              anomalies.push({ category, month: d.month, year: d.year, amount: Math.round(d.amount), expected: Math.round(mean), deviation: z > 0 ? 'high' : 'low', deviationPercent: ((d.amount - mean) / mean * 100).toFixed(1) });
            }
          });
        }
      })
    );
    anomalies.sort((a, b) => Math.abs(parseFloat(b.deviationPercent)) - Math.abs(parseFloat(a.deviationPercent)));
    return anomalies;
  }

  generateRecommendations(categoryData: Record<string, any[]>, predictions: any) {
    const recommendations: any[] = [];
    const trends = predictions?.trends || {};
    const monthOverMonth = this._calculateMomSync(categoryData);

    for (const [category, trend] of Object.entries(trends) as [string, any][]) {
      if (trend.direction === 'increasing' && trend.percentChangePerMonth > 10) {
        recommendations.push({ type: 'warning', category, title: `${category} spending is increasing`, description: `Your ${category} expenses have been growing by ${trend.percentChangePerMonth.toFixed(1)}% per month.`, priority: 'high', potentialSavings: Math.round(trend.averageAmount * 0.1) });
      }
    }

    const topSpending = this.identifyTopSpending(categoryData);
    topSpending.slice(0, 2).forEach((cat: any) => {
      if (parseFloat(cat.percentage) > 30) {
        recommendations.push({ type: 'insight', category: cat.category, title: `${cat.category} dominates your spending`, description: `${cat.percentage}% of your total spending goes to ${cat.category}.`, priority: 'medium', potentialSavings: Math.round(cat.average * 0.15) });
      }
    });

    for (const [category, mom] of Object.entries(monthOverMonth) as [string, any][]) {
      if (mom.percentChange > 25) {
        recommendations.push({ type: 'alert', category, title: `Sudden spike in ${category}`, description: `${category} increased by ${mom.percentChange}% compared to the previous month.`, priority: 'high', potentialSavings: Math.round(mom.change * 0.5) });
      }
    }

    for (const [category, trend] of Object.entries(trends) as [string, any][]) {
      if (trend.direction === 'decreasing' && trend.percentChangePerMonth < -5) {
        recommendations.push({ type: 'success', category, title: `Great job reducing ${category}!`, description: `You've reduced ${category} spending by ${Math.abs(trend.percentChangePerMonth).toFixed(1)}% per month.`, priority: 'low', potentialSavings: 0 });
      }
    }

    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    return recommendations;
  }

  findSavingsOpportunities(categoryData: Record<string, any[]>, predictions: any) {
    const opportunities: any[] = [];
    const topSpending = this.identifyTopSpending(categoryData);

    if (topSpending.length > 0) {
      const top = topSpending[0];
      opportunities.push({ category: top.category, suggestion: `Set a budget limit of ₹${Math.round(top.average * 0.9).toLocaleString()} for ${top.category}`, potentialMonthlySavings: Math.round(top.average * 0.1), potentialYearlySavings: Math.round(top.average * 0.1 * 12), difficulty: 'medium' });
    }

    const personal = categoryData['Personal'];
    if (personal && personal.length > 0) {
      const avgPersonal = personal.reduce((sum: number, d: any) => sum + d.amount, 0) / personal.length;
      if (avgPersonal > 5000) {
        opportunities.push({ category: 'Personal', suggestion: 'Track discretionary spending more closely', potentialMonthlySavings: Math.round(avgPersonal * 0.2), potentialYearlySavings: Math.round(avgPersonal * 0.2 * 12), difficulty: 'easy' });
      }
    }

    if (predictions?.totalPredicted > 0) {
      const predictedTotal = predictions.totalPredicted;
      const summary = this.generateSummary(categoryData, predictions);
      if (predictedTotal > summary.overallMonthlyAverage * 1.1) {
        opportunities.push({ category: 'Overall', suggestion: `Predicted spending is ${summary.predictedVsAverage}% above average. Plan carefully.`, potentialMonthlySavings: Math.round(predictedTotal - summary.overallMonthlyAverage), potentialYearlySavings: Math.round((predictedTotal - summary.overallMonthlyAverage) * 12), difficulty: 'medium' });
      }
    }

    return opportunities;
  }

  generateTextInsights(analysis: any) {
    const insights: any[] = [];
    const summary = analysis.summary;
    insights.push({ type: 'summary', text: `Over the last 6 months, you spent ₹${summary.totalSpentLast6Months.toLocaleString()}, averaging ₹${summary.overallMonthlyAverage.toLocaleString()} per month.` });

    if (summary.predictedNextMonth > 0) {
      const direction = parseFloat(summary.predictedVsAverage) > 0 ? 'more' : 'less';
      insights.push({ type: 'prediction', text: `You're predicted to spend ₹${summary.predictedNextMonth.toLocaleString()} next month — ${Math.abs(summary.predictedVsAverage)}% ${direction} than average.` });
    }

    if (analysis.topSpending.length > 0) {
      const top = analysis.topSpending[0];
      insights.push({ type: 'top-spending', text: `Top category: ${top.category} at ${top.percentage}% of spending (₹${top.total.toLocaleString()} over 6 months).` });
    }

    if (analysis.anomalies.length > 0) {
      const anomaly = analysis.anomalies[0];
      const monthName = new Date(anomaly.year, anomaly.month - 1).toLocaleString('default', { month: 'long' });
      insights.push({ type: 'anomaly', text: `Unusual: ${anomaly.category} in ${monthName} was ${anomaly.deviationPercent}% ${anomaly.deviation === 'high' ? 'higher' : 'lower'} than usual.` });
    }

    const highRec = analysis.recommendations.find((r: any) => r.priority === 'high');
    if (highRec) {
      insights.push({ type: 'recommendation', text: highRec.description });
    }

    return insights;
  }

  _calculateMomSync(categoryData: Record<string, any[]>) {
    const changes: Record<string, any> = {};
    for (const [category, data] of Object.entries(categoryData)) {
      if (data.length < 2) { changes[category] = { change: 0, percentChange: 0, trend: 'stable' }; continue; }
      const sortedData = [...data].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      const lastMonth = sortedData[sortedData.length - 1].amount;
      const previousMonth = sortedData[sortedData.length - 2].amount;
      const change = lastMonth - previousMonth;
      const percentChange = previousMonth > 0 ? parseFloat(((change / previousMonth) * 100).toFixed(1)) : 0;
      let trend = 'stable';
      if (percentChange > 10) trend = 'increasing';
      else if (percentChange < -10) trend = 'decreasing';
      changes[category] = { lastMonth: Math.round(lastMonth), previousMonth: Math.round(previousMonth), change: Math.round(change), percentChange, trend };
    }
    return changes;
  }
}

export default SpendingAnalyzer;
