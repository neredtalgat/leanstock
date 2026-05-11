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

  async getInventoryMovements(tenantId: string, filters: {
    productId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = { tenantId };

    if (filters.productId) {
      where.productId = filters.productId;
    }
    if (filters.locationId) {
      where.locationId = filters.locationId;
    }
    if (filters.startDate) {
      where.createdAt = { gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      where.createdAt = { lte: new Date(filters.endDate) };
    }

    const movements = await (tenantDb as any).inventoryMovement.findMany({
      where,
      include: {
        product: {
          select: { id: true, sku: true, name: true },
        },
        location: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return movements;
  }

  async getDeadStock(tenantId: string, daysThreshold: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    const deadStock = await (tenantDb as any).inventory.findMany({
      where: {
        tenantId,
        lastMovedAt: { lt: cutoffDate },
        quantity: { gt: 0 },
      },
      include: {
        product: {
          select: { id: true, sku: true, name: true },
        },
        location: {
          select: { id: true, name: true },
        },
      },
      orderBy: { lastMovedAt: 'asc' },
    });

    return deadStock.map((inv: any) => ({
      id: inv.id,
      product: inv.product,
      location: inv.location,
      currentStock: inv.quantity,
      daysInInventory: Math.floor((Date.now() - new Date(inv.lastMovedAt).getTime()) / (1000 * 60 * 60 * 24)),
      lastMovedAt: inv.lastMovedAt,
    }));
  }

  async getReorderSuggestions(tenantId: string) {
    const lowStockItems = await this.getLowStock(tenantId);
    
    return lowStockItems.items.map((item: any) => ({
      productId: item.product.id,
      productSku: item.product.sku,
      productName: item.product.name,
      locationId: item.location.id,
      locationName: item.location.name,
      currentStock: item.currentStock,
      minStockLevel: item.minStockLevel,
      maxStockLevel: item.maxStockLevel,
      suggestedReorderQty: item.suggestedReorderQty,
      urgency: item.urgency,
      estimatedDaysOfStock: item.currentStock > 0 ? Math.floor(item.currentStock / (item.suggestedReorderQty / 30)) : 0,
    }));
  }

  async getSupplierPerformance(tenantId: string, filters: {
    supplierId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = { tenantId };

    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }
    if (filters.startDate) {
      where.createdAt = { gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      where.createdAt = { lte: new Date(filters.endDate) };
    }

    // This would require supplier-related tables to be implemented
    // For now, return empty array
    return [];
  }

  async getTransferStatus(tenantId: string, filters: {
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    const where: any = { tenantId };

    if (filters.startDate) {
      where.createdAt = { gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      where.createdAt = { lte: new Date(filters.endDate) };
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const transfers = await (tenantDb as any).transfer.findMany({
      where,
      include: {
        fromLocation: {
          select: { id: true, name: true },
        },
        toLocation: {
          select: { id: true, name: true },
        },
        product: {
          select: { id: true, sku: true, name: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers;
  }
}

export const reportFixedService = new ReportService();
