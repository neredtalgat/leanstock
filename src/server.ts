import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { loadScripts } from './config/redis';

async function startServer(): Promise<void> {
  try {
    // Load Redis Lua scripts
    await loadScripts();

    const app = createApp();

    app.listen(env.PORT, () => {
      logger.info(`🚀 Server started on port ${env.PORT}`);
      logger.info(`📝 Environment: ${env.NODE_ENV}`);
      logger.info(`🏥 Health check: http://localhost:${env.PORT}/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`\n📴 Received ${signal}, shutting down gracefully...`);

      // Give connections time to finish
      await new Promise((resolve) => setTimeout(resolve, 5000));

      logger.info('✅ Server shut down');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error({ err: error }, 'Uncaught exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ promise, reason }, 'Unhandled rejection');
      process.exit(1);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
