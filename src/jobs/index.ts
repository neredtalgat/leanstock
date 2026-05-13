import { scheduleReorderCheck, triggerManualReorderCheck, closeReorderWorker } from './reorderCheck';
import { scheduleDeadStockJob, closeDeadStockWorker } from './deadStock.job';
import { emailWorker, closeEmailWorker } from './email.job';

/**
 * Initialize all background jobs and scheduled tasks
 */
export function initializeJobs() {
  // Schedule periodic reorder checks
  scheduleReorderCheck();
  scheduleDeadStockJob();
  
  logger.info('All background jobs initialized');
}

/**
 * Stop all background jobs gracefully
 */
export async function stopJobs(): Promise<void> {
  await Promise.all([
    closeReorderWorker(),
    closeDeadStockWorker(),
    closeEmailWorker(),
  ]);
  logger.info('All background jobs stopped');
}

export { triggerManualReorderCheck, scheduleReorderCheck, scheduleDeadStockJob };
export * from './reorderCheck';
export * from './email.job';
import { logger } from '../config/logger';
