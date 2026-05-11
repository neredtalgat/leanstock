import { Worker, Queue } from 'bullmq';
import { redis } from '../config/redis';
import { deadStockService } from '../services/deadStock.service';
import { tenantDb, asyncLocalStorage } from '../config/database';
import { logger } from '../config/logger';

const deadStockQueue = new Queue('dead-stock-discounts', { connection: redis });

// Worker to process dead stock discounts
export const deadStockWorker = new Worker(
  'dead-stock-discounts',
  async () => {
    logger.info('Starting dead stock discount job');

    try {
      // Get all active tenants
      const tenants = await tenantDb.tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      let totalUpdated = 0;

      for (const tenant of tenants) {
        logger.info(`Processing dead stock for tenant: ${tenant.name} (${tenant.id})`);

        // Set tenant context using run() to properly isolate context
        await asyncLocalStorage.run({ tenantId: tenant.id }, async () => {
          const updated = await deadStockService.applyDiscounts(tenant.id);
          totalUpdated += updated;
          logger.info(`Tenant ${tenant.id}: ${updated} products discounted`);
        });
      }

      logger.info(`Dead stock job completed: ${totalUpdated} products updated`);
      return { totalUpdated };
    } catch (error) {
      logger.error({ err: error }, 'Dead stock job failed');
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 1,
  },
);

// Schedule daily run at 2:00 AM
export const scheduleDeadStockJob = () => {
  deadStockQueue.add(
    'apply-discounts',
    {},
    {
      repeat: {
        pattern: '0 2 * * *', // Cron: 2:00 AM daily
      },
    },
  );
  logger.info('Dead stock job scheduled for daily 2:00 AM');
};

deadStockWorker.on('completed', (job) => {
  logger.info(`Dead stock job ${job.id} completed`);
});

deadStockWorker.on('failed', (job, err) => {
  logger.error({ err }, `Dead stock job ${job?.id} failed`);
});

/**
 * Close worker gracefully
 */
export async function closeDeadStockWorker(): Promise<void> {
  await deadStockWorker.close();
  await deadStockQueue.close();
}
