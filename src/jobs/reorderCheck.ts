import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { db } from '../config/database';

// Queue for reorder checks
const reorderQueue = new Queue('reorder-checks', { connection: redis });

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
    // Find all inventory items that are below reorder point
    const lowStockItems = await db.inventory.findMany({
      where: { tenantId },
      include: {
        product: true,
        location: true,
        reorderPoint: true,
      },
    });

    for (const item of lowStockItems) {
      if (!item.reorderPoint) continue;

      const availableStock = item.quantity - item.reservedQuantity;

      if (availableStock <= item.reorderPoint.minQuantity) {
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
          // Create notification for low stock
          const recommendedQuantity = item.reorderPoint.maxQuantity - availableStock;

          await db.notification.create({
            data: {
              tenantId,
              type: 'LOW_STOCK',
              message: `Low stock alert: ${item.product.name} at ${item.location.name}. Current: ${availableStock}, Min: ${item.reorderPoint.minQuantity}, Recommended order: ${recommendedQuantity}`,
            },
          });

          logger.info(`Low stock notification created for product ${item.productId} in tenant ${tenantId}`);
        }
      }
    }
  } catch (error) {
    logger.error({ err: error, tenantId }, 'Error checking tenant');
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

export { reorderQueue, worker };
