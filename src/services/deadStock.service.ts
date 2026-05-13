import { tenantDb } from '../config/database';
import { logger } from '../config/logger';
import { notificationService } from './notification.service';

class DeadStockService {
  /**
   * Apply discounts based on days in inventory
   * Tier 1: 30-60 days -> 10% discount
   * Tier 2: 60-90 days -> 20% discount
   * Tier 3: 90+ days -> 30% discount
   * Floor: price cannot go below baseCost * 1.1
   */
  async applyDiscounts(tenantId: string): Promise<number> {
    try {
      const products = await tenantDb.product.findMany({
        where: { tenantId },
        include: { inventory: true },
      });

      let updatedCount = 0;

      for (const product of products) {
        // Find inventory with longest days in stock
        const inventoryWithDays = product.inventory.map((inv: any) => {
          const daysInStock = Math.floor(
            (Date.now() - new Date(inv.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
          );
          return { ...inv, daysInStock };
        });

        const maxDays = Math.max(...inventoryWithDays.map((i: any) => i.daysInStock), 0);

        if (maxDays < 30) continue; // Skip if not dead stock

        // Determine discount tier
        let discount = 0;
        if (maxDays >= 90) discount = 0.3;
        else if (maxDays >= 60) discount = 0.2;
        else if (maxDays >= 30) discount = 0.1;

        // Calculate new price with floor
        const floorPrice = product.baseCost * 1.1;
        const newPrice = Math.max(product.retailPrice * (1 - discount), floorPrice);

        if (newPrice === product.retailPrice) continue; // No change

        const oldPrice = product.retailPrice;

        // Update product price
        await tenantDb.product.update({
          where: { id: product.id },
          data: { retailPrice: newPrice },
        });

        // Create price history
        await tenantDb.priceHistory.create({
          data: {
            tenantId,
            productId: product.id,
            oldPrice,
            newPrice,
            reason: `Dead stock discount (${Math.round(discount * 100)}%)`,
          },
        });

        // Send notification with EMAIL to managers
        await notificationService.notifyDeadStockDiscount(
          tenantId,
          product.id,
          product.name,
          maxDays,
          oldPrice,
          newPrice,
          Math.round(discount * 100)
        );

        updatedCount++;
        logger.info(
          `Dead stock discount applied: ${product.sku}, ${Math.round(discount * 100)}%, $${oldPrice} -> $${newPrice}`,
        );
      }

      logger.info(`Dead stock discounts applied for ${updatedCount} products in tenant ${tenantId}`);
      return updatedCount;
    } catch (error) {
      logger.error({ err: error }, 'Failed to apply dead stock discounts');
      throw error;
    }
  }
}

export const deadStockService = new DeadStockService();
