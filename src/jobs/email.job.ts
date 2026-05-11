import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { emailService } from '../services/email.service';
import { logger } from '../config/logger';

export const emailQueue = new Queue('email', { connection: redis });

export const emailWorker = new Worker(
  'email',
  async (job) => {
    try {
      const { to, subject, html } = job.data;

      logger.info(`Processing email job ${job.id}: ${to}`);

      await emailService.send({
        to,
        subject,
        html,
      });

      logger.info(`Email job ${job.id} completed successfully`);
    } catch (error) {
      logger.error({ err: error }, `Email job ${job.id} failed`);
      throw error; // BullMQ will retry based on job configuration
    }
  },
  { connection: redis }
);

emailWorker.on('completed', (job) => {
  logger.info(`Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  logger.error({ err }, `Email job ${job?.id} failed`);
});

export async function queueEmail(to: string, subject: string, html: string, attempts: number = 3): Promise<void> {
  try {
    await emailQueue.add(
      'send-email',
      { to, subject, html },
      {
        attempts,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    logger.info(`Email queued for ${to}`);
  } catch (error) {
    logger.error({ err: error }, `Failed to queue email for ${to}`);
    throw error;
  }
}
