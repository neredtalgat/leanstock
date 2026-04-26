import { dbClient } from '../config/database';
import { logger } from '../config/logger';

export class DeadStockService {
  async createRule(
    data: {
      name: string;
      daysThreshold: number;
      quantityMin?: number;
      action: string;
    },
    tenantId: string
  ) {
    const rule = await dbClient.deadStockRule.create({
      data: {
        ...data,
        tenantId,
        status: 'ACTIVE',
      },
    });

    logger.info({
      msg: 'Dead stock rule created',
      ruleId: rule.id,
      tenantId,
    });

    return rule;
  }

  async checkDeadStock(tenantId: string) {
    const rules = await dbClient.deadStockRule.findMany({
      where: { tenantId, status: 'ACTIVE' },
    });

    const deadStockItems = [];

    for (const rule of rules) {
      const cutoffDate = new Date(Date.now() - rule.daysThreshold * 24 * 60 * 60 * 1000);

      const items = await dbClient.inventory.findMany({
        where: {
          product: { tenantId },
          lastMovementDate: { lt: cutoffDate },
          quantity: rule.quantityMin ? { gte: rule.quantityMin } : undefined,
        },
        include: {
          product: true,
          location: true,
        },
      });

      deadStockItems.push(...items.map((item) => ({ ...item, rule })));
    }

    return deadStockItems;
  }

  async flagDeadStock(inventoryId: string, tenantId: string) {
    const inventory = await dbClient.inventory.findUnique({
      where: { id: inventoryId },
      include: { product: true },
    });

    if (!inventory) {
      throw new Error('Inventory not found');
    }

    logger.warn({
      msg: 'Dead stock flagged',
      productId: inventory.productId,
      quantity: inventory.quantity,
      daysInInventory: inventory.daysInInventory,
      tenantId,
    });

    return inventory;
  }
}

export const deadStockService = new DeadStockService();
export default deadStockService;
