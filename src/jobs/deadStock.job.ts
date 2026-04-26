import Queue from 'bull';
import { redis } from '../config/redis';
import { deadStockService } from '../services/deadStock.service';
import { logger } from '../config/logger';

// Create Bull queue using existing Redis connection
export const deadStockQueue = new Queue('dead-stock', {
  redis: {
    host: redis.options.host || 'localhost',
    port: redis.options.port || 6379,
    password: redis.options.password,
  },
});

/**
 * Process dead stock job
 * Runs daily at 2:00 AM
 */
deadStockQueue.process(async (job) => {
  logger.info({ jobId: job.id }, 'Starting dead stock processing job');

  try {
    const results = await deadStockService.processAllTenants();

    const summary = {
      processedTenants: results.size,
      totalUpdated: Array.from(results.values()).reduce((a, b) => a + b, 0),
      details: Object.fromEntries(results),
    };

    logger.info(summary, 'Dead stock job completed successfully');
    return summary;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Dead stock job failed'
    );
    throw error;
  }
});

/**
 * Schedule dead stock job to run daily at 2:00 AM
 */
export async function scheduleDeadStockJob() {
  try {
    // Remove existing scheduled jobs
    const jobs = await deadStockQueue.getRepeatableJobs();
    for (const job of jobs) {
      await deadStockQueue.removeRepeatableByKey(job.key);
    }

    // Add new scheduled job: every day at 02:00 AM
    await deadStockQueue.add(
      {},
      {
        repeat: {
          cron: '0 2 * * *', // Daily at 2:00 AM
          tz: 'UTC',
        },
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    logger.info('Dead stock job scheduled for daily execution at 2:00 AM UTC');
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to schedule dead stock job'
    );
    throw error;
  }
}

/**
 * Handle job events for logging and monitoring
 */
deadStockQueue.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'Dead stock job completed');
});

deadStockQueue.on('failed', (job, error) => {
  logger.error(
    { jobId: job.id, attempt: job.attemptsMade, error: error.message },
    'Dead stock job failed'
  );
});

deadStockQueue.on('error', (error) => {
  logger.error({ error: error.message }, 'Dead stock queue error');
});

/**
 * Graceful shutdown
 */
export async function closeDeadStockQueue() {
  await deadStockQueue.close();
  logger.info('Dead stock queue closed');
}
