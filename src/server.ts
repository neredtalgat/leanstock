import app from './app';
import { config } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { scheduleDeadStockJob, closeDeadStockQueue } from './jobs/deadStock.job';

const PORT = config.PORT;

const server = app.listen(PORT, async () => {
  logger.info(`🚀 Server is running on http://localhost:${PORT}`);

  // Initialize scheduled jobs
  try {
    await scheduleDeadStockJob();
    logger.info('Scheduled jobs initialized');
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to initialize scheduled jobs'
    );
  }
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Shutting down gracefully...');

  server.close(async () => {
    logger.info('HTTP server closed');

    // Close job queues
    try {
      await closeDeadStockQueue();
    } catch (error) {
      logger.error('Error closing job queues', error);
    }

    await prisma.$disconnect();
    logger.info('Database disconnected');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    msg: 'Unhandled Rejection',
    promise: String(promise),
    reason,
  });
});

export default server;
