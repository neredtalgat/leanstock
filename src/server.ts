import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { loadScripts, redis } from './config/redis';
import { db } from './config/database';
import { initializeJobs, stopJobs } from './jobs';
import { setShuttingDown, isGracefulShuttingDown } from './middleware/graceful-shutdown.middleware';

async function startServer(): Promise<void> {
  try {
    // Load Redis Lua scripts
    await loadScripts();

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      logger.info({
        message: `🚀 Server started on port ${env.PORT}`,
        port: env.PORT,
        environment: env.NODE_ENV,
        healthCheck: `http://localhost:${env.PORT}/health`,
        timestamp: new Date().toISOString()
      });
    });

    // Enhanced graceful shutdown
    const shutdown = async (signal: string) => {
      if (isGracefulShuttingDown()) {
        logger.info('Shutdown already in progress');
        return;
      }

      setShuttingDown();
      logger.info({
        message: `📴 Received ${signal}, shutting down gracefully...`,
        signal,
        timestamp: new Date().toISOString()
      });

      // Stop accepting new connections
      server.close(async () => {
        try {
          // Stop background jobs first (don't accept new jobs)
          logger.info('⏹ Stopping background jobs...');
          await stopJobs();
          
          // Wait for active connections to finish (max 30 seconds)
          await new Promise((resolve) => setTimeout(resolve, 30000));
          
          // Close database connections
          logger.info('📊 Closing database connections...');
          await db.$disconnect();
          
          // Close Redis connections
          logger.info('🔴 Closing Redis connections...');
          await redis.quit();
          
          logger.info({
            message: '✅ Server shut down gracefully',
            timestamp: new Date().toISOString()
          });
          process.exit(0);
        } catch (error) {
          logger.error({
            message: 'Error during shutdown',
            error,
            timestamp: new Date().toISOString()
          });
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon restart

    // Handle uncaught exceptions with enhanced logging
    process.on('uncaughtException', (error, origin) => {
      logger.error({
        message: 'Uncaught exception',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          origin
        },
        timestamp: new Date().toISOString()
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error({
        message: 'Unhandled rejection',
        error: {
          reason,
          promise: promise.toString(),
          stack: reason instanceof Error ? reason.stack : undefined
        },
        timestamp: new Date().toISOString()
      });
      process.exit(1);
    });

    // Handle memory warnings
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        logger.warn({
          message: 'Max listeners exceeded',
          warning: warning.toString(),
          timestamp: new Date().toISOString()
        });
      }
    });

  } catch (error) {
    logger.error({
      message: 'Failed to start server',
      error: {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      },
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
}

startServer();
