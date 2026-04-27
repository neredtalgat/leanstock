import { scheduleReorderCheck, triggerManualReorderCheck } from './reorderCheck';

/**
 * Initialize all background jobs and scheduled tasks
 */
export const initializeJobs = (): void => {
  // Schedule periodic reorder checks
  scheduleReorderCheck();
};

export { triggerManualReorderCheck };
export * from './reorderCheck';
