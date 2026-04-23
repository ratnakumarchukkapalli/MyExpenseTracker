/**
 * ReportGenerator — orchestrates ML prediction and analysis to generate monthly reports.
 * IPC calls replaced with REST API fetch calls.
 */

import SpendingPredictor from './SpendingPredictor';
import SpendingAnalyzer from './SpendingAnalyzer';
import { EXPENSE_CATEGORIES } from '../../constants/categories';

class ReportGenerator {
  predictor: SpendingPredictor;
  analyzer: SpendingAnalyzer;
  categories: string[];

  constructor() {
    this.predictor = new SpendingPredictor();
    this.analyzer = new SpendingAnalyzer();
    this.categories = [...EXPENSE_CATEGORIES];
  }


  async fetchHistoricalData(months = 6, excludeMonth?: number, excludeYear?: number): Promise<any> {
    try {
      const params = new URLSearchParams({ months: String(months) });
      if (excludeMonth != null) params.set('excludeMonth', String(excludeMonth));
      if (excludeYear != null) params.set('excludeYear', String(excludeYear));

      const res = await fetch(`/api/expenses/historical?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      console.error('Error fetching historical data:', error);
      throw error;
    }
  }

  async generateReport(targetMonth: number, targetYear: number): Promise<any> {
    console.log(`Generating report for ${targetMonth}/${targetYear}...`);

    try {
      const historicalData = await this.fetchHistoricalData(6, targetMonth, targetYear);

      if (!historicalData || Object.keys(historicalData).length === 0) {
        console.warn('No historical data available for report generation');
        return {
          success: false,
          error: 'Insufficient historical data. Need at least 2 months of expense data.',
          reportMonth: targetMonth,
          reportYear: targetYear,
        };
      }

      const predictions = await this.predictor.trainAndPredict(historicalData);

      const analysis = await this.analyzer.analyze(
        historicalData,
        predictions,
        targetMonth,
        targetYear
      );

      const textInsights = this.analyzer.generateTextInsights(analysis);

      const report = {
        success: true,
        reportMonth: targetMonth,
        reportYear: targetYear,
        generatedAt: new Date().toISOString(),
        historicalData,
        predictions: {
          byCategory: predictions.predictions,
          trends: predictions.trends,
          totalPredictedExpenses: predictions.totalPredictedExpenses,
          predictedSavings: predictions.predictedSavings,
          totalPredicted: predictions.totalPredicted,
        },
        analysis,
        textInsights,
        modelStats: predictions.trainingStats,
      };

      await this.saveReport(report);

      console.log('Report generated successfully');
      return report;
    } catch (error: any) {
      console.error('Error generating report:', error);
      return {
        success: false,
        error: error.message,
        reportMonth: targetMonth,
        reportYear: targetYear,
      };
    } finally {
      this.predictor.dispose();
    }
  }

  async saveReport(report: any): Promise<void> {
    try {
      const res = await fetch(`/api/reports/${report.reportMonth}/${report.reportYear}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log('Report saved');
    } catch (error) {
      console.warn('Could not save report:', error);
    }
  }

  async loadReport(month: number, year: number): Promise<any> {
    try {
      const res = await fetch(`/api/reports/${month}/${year}`);
      if (!res.ok) return null;
      return res.json();
    } catch (error) {
      console.warn('Could not load report:', error);
      return null;
    }
  }

  async shouldGenerateNewReport(month: number, year: number): Promise<boolean> {
    try {
      const existingReport = await this.loadReport(month, year);
      if (!existingReport) return true;
      const reportDate = new Date(existingReport.generatedAt);
      const hoursSince = (Date.now() - reportDate.getTime()) / (1000 * 60 * 60);
      return hoursSince > 12;
    } catch {
      return true;
    }
  }

  async getOrGenerateReport(month: number, year: number, forceRegenerate = false): Promise<any> {
    if (!forceRegenerate) {
      const needsRegen = await this.shouldGenerateNewReport(month, year);
      if (!needsRegen) {
        const existing = await this.loadReport(month, year);
        if (existing) {
          console.log('Using cached report');
          return existing;
        }
      }
    }

    console.log('Generating new report...');
    const fresh = await this.generateReport(month, year);
    if (!fresh.success) {
      const cached = await this.loadReport(month, year);
      if (cached) {
        console.warn('Regeneration failed, using cached report');
        return cached;
      }
    }
    return fresh;
  }

  async generatePreviewReport(): Promise<any> {
    const now = new Date();
    return this.generateReport(now.getMonth() + 1, now.getFullYear());
  }

  async getAvailableReports(): Promise<any[]> {
    // Not supported in webapp
    return [];
  }
}

export default ReportGenerator;
