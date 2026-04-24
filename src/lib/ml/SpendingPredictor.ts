/**
 * SpendingPredictor — delegates math to the Python FastAPI server when available.
 * Falls back gracefully if the API is not running.
 */

import { ML_API_URL } from './config';

async function mlAnalyze(endpoint: string, payload: unknown): Promise<any> {
  try {
    const res = await fetch(`${ML_API_URL}/${endpoint}`, {
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

class SpendingPredictor {
  categoryPredictions: Record<string, any>;

  constructor() {
    this.categoryPredictions = {};
  }

  async predictCategory(historicalData: any[], category = ''): Promise<any> {
    if (!historicalData || historicalData.length === 0) return null;

    const result = await mlAnalyze('predict-spending', {
      history: historicalData,
      category,
    });
    if (!result || result.error) return null;
    return result;
  }

  async trainAndPredict(categoryData: Record<string, any[]>) {
    const results: any = {
      predictions: {},
      trends: {},
      trainingStats: {},
      totalPredicted: 0,
      totalPredictedExpenses: 0,
      predictedSavings: 0,
    };

    const entries = Object.entries(categoryData).filter(([, data]) => data && data.length > 0);

    const settled = await Promise.all(
      entries.map(async ([category, data]) => {
        try {
          const res = await this.predictCategory(data, category);
          return { category, data, res };
        } catch {
          return { category, data, res: null };
        }
      })
    );

    for (const { category, data, res } of settled) {
      if (!res) continue;

      const predicted = res.predicted;
      const amounts = data.map((d: any) => d.amount);
      const averageAmount = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
      results.trends[category] = {
        slope: res.slope,
        direction: res.trend,
        percentChangePerMonth: averageAmount > 0 ? (res.slope / averageAmount) * 100 : 0,
        averageAmount,
      };

      if (predicted !== null && predicted !== undefined) {
        results.predictions[category] = { amount: predicted, confidence: res.confidence };
        results.trainingStats[category] = {
          category,
          dataPoints: data.length,
          algorithm: 'WMA-Python',
        };

        if (category === 'Savings') {
          results.predictedSavings = predicted;
        } else {
          results.totalPredictedExpenses += predicted;
        }
        results.totalPredicted += predicted;
      }
    }

    return results;
  }

  dispose() {
    this.categoryPredictions = {};
  }
}

export default SpendingPredictor;
