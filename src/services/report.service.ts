import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

class ReportService {
  async getLowStock(tenantId: string) {
    const inventory = await (tenantDb as any).inventory.findMany({
      where: {
        tenantId,
        minStockLevel: { not: null },
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            basePrice: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { quantity: 'asc' },
    });

    // Filter low stock and calculate urgency
    const lowStockItems = inventory
      .filter((inv: any) => inv.quantity < inv.minStockLevel)
      .map((inv: any) => {
        const shortage = inv.minStockLevel - inv.quantity;
        const suggestedReorderQty = Math.max(
          inv.maxStockLevel ? inv.maxStockLevel - inv.quantity : shortage * 2,
          shortage
        );

        // Calculate urgency score (lower is more urgent)
        const stockRatio = inv.quantity / inv.minStockLevel;
        let urgency = 'LOW';
        if (stockRatio <= 0.1) urgency = 'CRITICAL';
        else if (stockRatio <= 0.5) urgency = 'HIGH';
        else if (stockRatio <= 0.8) urgency = 'MEDIUM';

        return {
          id: inv.id,
          product: inv.product,
          location: inv.location,
          currentStock: inv.quantity,
          minStockLevel: inv.minStockLevel,
          maxStockLevel: inv.maxStockLevel,
          shortage,
          suggestedReorderQty,
          urgency,
          daysInInventory: inv.daysInInventory,
          lastMovedAt: inv.lastMovedAt,
        };
      })
      .sort((a: any, b: any) => {
        const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return urgencyOrder[a.urgency as keyof typeof urgencyOrder] - urgencyOrder[b.urgency as keyof typeof urgencyOrder];
      });

    logger.info(`Low stock report generated: ${lowStockItems.length} items for tenant ${tenantId}`);

    return {
      totalItems: lowStockItems.length,
      critical: lowStockItems.filter((i: any) => i.urgency === 'CRITICAL').length,
      high: lowStockItems.filter((i: any) => i.urgency === 'HIGH').length,
      medium: lowStockItems.filter((i: any) => i.urgency === 'MEDIUM').length,
      low: lowStockItems.filter((i: any) => i.urgency === 'LOW').length,
      items: lowStockItems,
    };
  }
}

export const reportService = new ReportService();
