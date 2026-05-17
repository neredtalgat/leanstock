import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

export interface ForecastResult {
  productId: string;
  days: number;
  historicalDemand: number[];
  predictedDemand: number;
  recommendedReorderQty: number;
  confidence: 'low' | 'medium' | 'high';
  method: 'moving_average';
  averageDailyDemand: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

class ForecastingService {
  async forecast(productId: string, tenantId: string, days: number = 30): Promise<ForecastResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const history = await (tenantDb as any).demandHistory.findMany({
      where: { tenantId, productId, date: { gte: cutoffDate } },
      orderBy: { date: 'asc' },
    });

    const demandQuantities = history.map((h: any) => h.demandQuantity);
    const totalDemand = demandQuantities.reduce((a: number, b: number) => a + b, 0);
    const dataPoints = demandQuantities.length;

    const averageDailyDemand = dataPoints > 0 ? totalDemand / dataPoints : 0;
    const predictedDemand = Math.round(averageDailyDemand * 30);

    let confidence: 'low' | 'medium' | 'high' = 'low';
    if (dataPoints >= 30) confidence = 'high';
    else if (dataPoints >= 14) confidence = 'medium';

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (dataPoints >= 7) {
      const firstHalf = demandQuantities.slice(0, Math.floor(dataPoints / 2));
      const secondHalf = demandQuantities.slice(Math.floor(dataPoints / 2));
      const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length || 1;
      const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length || 1;
      if (secondAvg > firstAvg * 1.1) trend = 'increasing';
      else if (secondAvg < firstAvg * 0.9) trend = 'decreasing';
    }

    const reorderPoint = await (tenantDb as any).reorderPoint.findFirst({
      where: { tenantId, productId },
    });

    let recommendedReorderQty = 0;
    if (reorderPoint) {
      const currentInventory = await (tenantDb as any).inventory.findFirst({
        where: { tenantId, productId },
      });
      const currentQty = currentInventory?.quantity || 0;
      const projectedNeed = predictedDemand + reorderPoint.minQuantity;
      recommendedReorderQty = Math.max(0, projectedNeed - currentQty);
    }

    logger.info({ productId, tenantId, days, predictedDemand, confidence }, 'Forecast generated');

    return {
      productId, days, historicalDemand: demandQuantities, predictedDemand,
      recommendedReorderQty, confidence, method: 'moving_average',
      averageDailyDemand: Math.round(averageDailyDemand * 100) / 100, trend,
    };
  }

  async batchForecast(tenantId: string, days: number = 30): Promise<ForecastResult[]> {
    const products = await (tenantDb as any).product.findMany({
      where: { tenantId }, select: { id: true },
    });
    const results: ForecastResult[] = [];
    for (const product of products) {
      try {
        const forecast = await this.forecast(product.id, tenantId, days);
        results.push(forecast);
      } catch (error) {
        logger.error({ err: error, productId: product.id }, 'Failed to forecast product');
      }
    }
    return results;
  }
}

export const forecastingService = new ForecastingService();
