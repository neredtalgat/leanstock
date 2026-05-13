import { Worker, Queue } from 'bullmq';
import nodemailer from 'nodemailer';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';

interface EmailJobData {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

// Create transporter if SMTP is configured
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.EMAIL_FROM) {
    logger.warn('SMTP not configured - emails will be logged only');
    return null;
  }
  
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
  
  return transporter;
}

// Email queue for adding jobs
const emailQueue = new Queue('email-sending', { 
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Worker to process email jobs
const emailWorker = new Worker<EmailJobData>(
  'email-sending',
  async (job) => {
    const { to, subject, html, text } = job.data;
    
    logger.info({ jobId: job.id, to, subject }, 'Processing email job');
    
    const mailer = getTransporter();
    
    if (!mailer) {
      // Log email for development/testing
      logger.info({ 
        jobId: job.id,
        to, 
        subject, 
        html: html?.substring(0, 200) + '...',
        text: text?.substring(0, 200) + '...',
      }, '[EMAIL MOCK] Email would be sent (SMTP not configured)');
      return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
    }
    
    try {
      const info = await mailer.sendMail({
        from: `"LeanStock" <${env.EMAIL_FROM}>`,
        to,
        subject,
        text,
        html,
      });
      
      logger.info({ 
        jobId: job.id, 
        to, 
        subject, 
        messageId: info.messageId 
      }, 'Email sent successfully');
      
      return { 
        sent: true, 
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl?.(info),
      };
    } catch (error) {
      logger.error({ err: error, jobId: job.id, to }, 'Failed to send email');
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
  },
);

emailWorker.on('completed', (job, result) => {
  logger.debug({ jobId: job.id, result }, 'Email job completed');
});

emailWorker.on('failed', (job, err) => {
  logger.error({ err, jobId: job?.id }, 'Email job failed');
});

/**
 * Add email to queue for async sending
 */
export async function queueEmail(data: EmailJobData): Promise<string> {
  const job = await emailQueue.add('send-email', data);
  return job.id as string;
}

/**
 * Get email queue status
 */
export async function getEmailQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const [waiting, active, completed, failed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
  ]);
  
  return { waiting, active, completed, failed };
}

/**
 * Close worker gracefully
 */
export async function closeEmailWorker(): Promise<void> {
  await emailWorker.close();
  await emailQueue.close();
}

export { emailWorker, emailQueue };
