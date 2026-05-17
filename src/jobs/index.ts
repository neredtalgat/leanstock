import { scheduleReorderCheck, triggerManualReorderCheck, closeReorderWorker } from './reorderCheck';
import { scheduleDeadStockJob, closeDeadStockWorker } from './deadStock.job';
import { closeReservationWorker } from '../workers/reservation.worker';
import { 
  mailWorker, 
  addMailJob, 
  getMailQueueMetrics,
  getFailedJobs,
  retryFailedJob,
  cleanOldJobs,
  closeMailWorker,
} from '../workers/mail.worker';
import { mailQueue } from '../queues/mail.queue';
import { logger } from '../config/logger';

// Re-export types from queue
export type {
  EmailJobData,
  SendEmailJob,
  SendVerificationJob,
  SendPasswordResetJob,
  SendBusinessEventJob,
  SendBulkEmailJob,
  SendInvitationJob,
} from '../queues/mail.queue';

/**
 * Initialize all background jobs and scheduled tasks
 */
export function initializeJobs() {
  // Schedule periodic reorder checks
  scheduleReorderCheck();
  scheduleDeadStockJob();
  
  // Mail worker is automatically started when imported
  // (Worker instance is created in mail.worker.ts)
  logger.info('✅ Mail worker initialized');
  
  logger.info('✅ All background jobs initialized');
}

/**
 * Stop all background jobs gracefully
 */
export async function stopJobs(): Promise<void> {
  await Promise.all([
    closeReorderWorker(),
    closeDeadStockWorker(),
    closeMailWorker(),
    closeReservationWorker(),
  ]);
  logger.info('All background jobs stopped');
}

/**
 * Queue health check
 */
export async function getJobsHealth(): Promise<{
  mail: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  };
}> {
  const mailMetrics = await getMailQueueMetrics();
  
  return {
    mail: mailMetrics,
  };
}

// Re-exports for convenience
export { 
  triggerManualReorderCheck, 
  scheduleReorderCheck, 
  scheduleDeadStockJob,
  addMailJob,
  getMailQueueMetrics,
  getFailedJobs,
  retryFailedJob,
  cleanOldJobs,
};

// Export mail worker instance for advanced use
export { mailWorker, mailQueue };
