import { scheduleReorderCheck, triggerManualReorderCheck, closeReorderWorker } from './reorderCheck';
import { scheduleDeadStockJob, closeDeadStockWorker } from './deadStock.job';

/**
 * Initialize all background jobs and scheduled tasks
 */
export function initializeJobs() {
  // Schedule periodic reorder checks
  scheduleReorderCheck();
  scheduleDeadStockJob();
}

/**
 * Stop all background jobs gracefully
 */
export async function stopJobs(): Promise<void> {
  await Promise.all([
    closeReorderWorker(),
    closeDeadStockWorker(),
  ]);
}

export { triggerManualReorderCheck, scheduleReorderCheck, scheduleDeadStockJob };
export * from './reorderCheck';
