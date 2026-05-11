import { scheduleReorderCheck, triggerManualReorderCheck } from './reorderCheck';
import { scheduleDeadStockJob } from './deadStock.job';

/**
 * Initialize all background jobs and scheduled tasks
 */
export function initializeJobs() {
  // Schedule periodic reorder checks
  scheduleReorderCheck();
  scheduleDeadStockJob();
}

export { triggerManualReorderCheck, scheduleReorderCheck, scheduleDeadStockJob };
export * from './reorderCheck';
