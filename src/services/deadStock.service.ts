import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { createAuditLog } from '../utils/audit';

export class DeadStockService {
  /**
   * Apply automatic discounts to dead stock based on daysInInventory
   * Tier 1: 30-60 days → 10% discount
   * Tier 2: 61-90 days → 20% discount
   * Tier 3: 91-180 days → 30% discount
   * Tier 4: 180+ days → 40% discount
   *
   * Price floor: max(newPrice, baseCost * 1.1) to ensure profit margin
   */
  async applyDiscounts(tenantId: string): Promise<number> {
    const now = new Date();
    let updatedCount = 0;

    try {
      // Find all inventory records with daysInInventory > 30
      const deadStockInventory = await prisma.inventory.findMany({
        where: {
          tenantId,
          lastMovementDate: {
            lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          product: true,
        },
      });

      logger.info(
        { tenantId, count: deadStockInventory.length },
        'Found dead stock items to process'
      );

      for (const inventory of deadStockInventory) {
        const product = inventory.product;
        const daysInInventory = Math.floor(
          (now.getTime() - inventory.lastMovementDate!.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Determine discount tier
        let discountPercent = 0;
        if (daysInInventory >= 180) {
          discountPercent = 40;
        } else if (daysInInventory >= 91) {
          discountPercent = 30;
        } else if (daysInInventory >= 61) {
          discountPercent = 20;
        } else if (daysInInventory >= 30) {
          discountPercent = 10;
        }

        if (discountPercent === 0) continue;

        // Calculate new price
        const discountedPrice = product.retailPrice * (1 - discountPercent / 100);
        const priceFloor = product.costPrice * 1.1; // Ensure 10% margin over cost
        const newPrice = Math.max(discountedPrice, priceFloor);

        // Only update if price actually changed
        if (newPrice !== product.retailPrice) {
          await prisma.$transaction(async (tx) => {
            // Update product price
            await tx.product.update({
              where: { id: product.id },
              data: {
                retailPrice: newPrice,
              },
            });

            // Create price history
            await tx.priceHistory.create({
              data: {
                tenantId,
                productId: product.id,
                oldPrice: product.retailPrice,
                newPrice,
                reason: `Dead stock discount: ${discountPercent}% (${daysInInventory} days in inventory)`,
                appliedBy: 'SYSTEM',
              },
            });

            // Create notification for managers
            const managers = await tx.user.findMany({
              where: {
                tenantId,
                role: { in: ['TENANT_ADMIN', 'REGIONAL_MANAGER', 'STORE_MANAGER'] },
              },
            });

            for (const manager of managers) {
              await tx.notification.create({
                data: {
                  tenantId,
                  userId: manager.id,
                  type: 'DEAD_STOCK_DISCOUNT',
                  title: `Dead Stock Alert: ${product.name}`,
                  message: `${product.name} (SKU: ${product.sku}) has been discounted by ${discountPercent}% due to ${daysInInventory} days in inventory. New price: $${newPrice.toFixed(2)}`,
                  resourceType: 'Product',
                  resourceId: product.id,
                  isRead: false,
                },
              });
            }

            // Audit log
            await createAuditLog({
              tenantId,
              action: 'APPLY_DEAD_STOCK_DISCOUNT',
              resourceType: 'Product',
              resourceId: product.id,
              userId: 'SYSTEM',
              changes: {
                oldPrice: product.retailPrice,
                newPrice,
                discount: `${discountPercent}%`,
                daysInInventory,
              },
            });

            updatedCount++;
          });
        }
      }

      logger.info(
        { tenantId, updatedCount },
        'Dead stock discounts applied successfully'
      );
      return updatedCount;
    } catch (error) {
      logger.error(
        { tenantId, error: error instanceof Error ? error.message : String(error) },
        'Error applying dead stock discounts'
      );
      throw error;
    }
  }

  /**
   * Process dead stock discounts for all active tenants
   * Called by BullMQ job daily at 2:00 AM
   */
  async processAllTenants(): Promise<Map<string, number>> {
    const results = new Map<string, number>();

    try {
      // Get all active tenants
      const tenants = await prisma.tenant.findMany({
        where: {
          isActive: true,
        },
      });

      logger.info(
        { tenantCount: tenants.length },
        'Starting dead stock processing for all tenants'
      );

      for (const tenant of tenants) {
        try {
          const count = await this.applyDiscounts(tenant.id);
          results.set(tenant.id, count);
        } catch (error) {
          logger.error(
            {
              tenantId: tenant.id,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to process dead stock for tenant'
          );
          results.set(tenant.id, 0);
        }
      }

      logger.info({ results: Object.fromEntries(results) }, 'Dead stock processing completed');
      return results;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error processing dead stock for all tenants'
      );
      throw error;
    }
  }
}

export const deadStockService = new DeadStockService();
