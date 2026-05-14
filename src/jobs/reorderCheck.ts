import { Queue, Worker, Job } from 'bullmq';
import { ReorderPoint } from '@prisma/client';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { db } from '../config/database';
import { notificationService } from '../services/notification.service';

// Queue for reorder checks
const reorderQueue = new Queue('reorder-checks', { 
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

interface ReorderCheckJob {
  tenantId?: string;
}

/**
 * Schedule periodic reorder checks for all tenants
 */
export const scheduleReorderCheck = (): void => {
  // Run every 6 hours
  reorderQueue.add('check-all-tenants', {}, { repeat: { every: 6 * 60 * 60 * 1000 } });
  logger.info('Reorder check scheduled to run every 6 hours');
};

/**
 * Schedule a single reorder check for a specific tenant
 */
export const scheduleTenantReorderCheck = (tenantId: string): Promise<Job> => {
  return reorderQueue.add('check-tenant', { tenantId }, { delay: 5000 });
};

/**
 * Worker that processes reorder check jobs
 */
const worker = new Worker<ReorderCheckJob>(
  'reorder-checks',
  async (job) => {
    logger.info(`Processing reorder check job: ${job.name}`);

    if (job.name === 'check-all-tenants') {
      await checkAllTenants();
    } else if (job.name === 'check-tenant' && job.data.tenantId) {
      await checkTenant(job.data.tenantId);
    }
  },
  { connection: redis },
);

worker.on('completed', (job) => {
  logger.info(`Reorder check job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  logger.error({ err, jobId: job?.id }, 'Reorder check job failed');
});

/**
 * Check all tenants for reorder points
 */
async function checkAllTenants(): Promise<void> {
  try {
    const tenants = await db.tenant.findMany({
      select: { id: true, name: true },
    });

    logger.info(`Checking reorder points for ${tenants.length} tenants`);

    for (const tenant of tenants) {
      await checkTenant(tenant.id);
    }
  } catch (error) {
    logger.error({ err: error }, 'Error checking all tenants');
    throw error;
  }
}

/**
 * Check a single tenant for reorder points
 */
async function checkTenant(tenantId: string): Promise<void> {
  try {
    // Find all inventory items with product and location info
    const inventoryItems = await db.inventory.findMany({
      where: { tenantId },
      include: {
        product: true,
        location: true,
      },
    });

    // Find all reorder points for tenant
    const reorderPoints = await db.reorderPoint.findMany({
      where: { tenantId },
    });

    // Create map for quick lookup
    const reorderPointMap = new Map<string, ReorderPoint>(
      reorderPoints.map((rp) => [`${rp.productId}_${rp.locationId}`, rp]),
    );

    let lowStockCount = 0;

    for (const item of inventoryItems) {
      const key = `${item.productId}_${item.locationId}`;
      const reorderPoint = reorderPointMap.get(key);

      if (!reorderPoint) continue;

      const availableStock = item.quantity - item.reservedQuantity;

      if (availableStock <= reorderPoint.minQuantity) {
        lowStockCount++;

        // Check if there's already an open PO for this product
        const existingPO = await db.purchaseOrder.findFirst({
          where: {
            tenantId,
            status: { in: ['DRAFT', 'SUBMITTED', 'CONFIRMED'] },
            items: {
              some: { productId: item.productId },
            },
          },
        });

        if (!existingPO) {
          const recommendedQuantity = reorderPoint.maxQuantity - availableStock;

          // Send notification with EMAIL to managers
          await notificationService.notifyLowStock(
            tenantId,
            item.productId,
            item.product.name,
            item.location.name,
            availableStock,
            reorderPoint.minQuantity,
            recommendedQuantity
          );

          logger.info(
            `Low stock notification sent for product ${item.product.name} at ${item.location.name} in tenant ${tenantId}`
          );
        }
      }
    }

    if (lowStockCount > 0) {
      logger.info(`Found ${lowStockCount} low stock items for tenant ${tenantId}`);
    }
  } catch (error) {
    logger.error({ err: error, tenantId }, 'Error checking tenant reorder points');
    throw error;
  }
}

/**
 * Manually trigger a reorder check
 */
export const triggerManualReorderCheck = async (tenantId?: string): Promise<void> => {
  if (tenantId) {
    await checkTenant(tenantId);
  } else {
    await checkAllTenants();
  }
};

/**
 * Close worker gracefully
 */
export async function closeReorderWorker(): Promise<void> {
  await worker.close();
  await reorderQueue.close();
}

export { reorderQueue, worker };
