import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { emailService } from '../services/email.service';
import { env } from '../config/env';
import { 
  mailQueue, 
  type EmailJobData,
  type SendEmailJob,
  type SendVerificationJob,
  type SendPasswordResetJob,
  type SendBusinessEventJob,
  type SendBulkEmailJob,
  type SendInvitationJob,
} from '../queues/mail.queue';

// Re-export types for convenience
export type {
  EmailJobData,
  SendEmailJob,
  SendVerificationJob,
  SendPasswordResetJob,
  SendBusinessEventJob,
  SendBulkEmailJob,
  SendInvitationJob,
};

/**
 * Job processing result
 */
interface JobResult {
  success: boolean;
  messageId?: string;
  error?: string;
  processedAt: string;
}

/**
 * Queue name for email jobs
 */
const QUEUE_NAME = 'mail-queue';

/**
 * Get priority value for job
 */
function getPriorityValue(priority?: string): number {
  switch (priority) {
    case 'high': return 1;
    case 'low': return 10;
    default: return 5;
  }
}

// ============== Email Templates (Worker Layer) ==============

function verificationEmailTemplate(firstName: string, verificationLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .button { display: inline-block; background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { background: #ecf0f1; padding: 10px; text-align: center; font-size: 12px; color: #7f8c8d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to LeanStock!</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Thank you for registering with LeanStock. To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
            <a href="${verificationLink}" class="button">Verify Email Address</a>
            <p>Or copy this link in your browser:</p>
            <p><code>${verificationLink}</code></p>
            <p><strong>This verification link will expire in 24 hours.</strong></p>
            <p>If you did not create this account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 LeanStock. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function passwordResetEmailTemplate(firstName: string, resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #e74c3c; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .button { display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { background: #ecf0f1; padding: 10px; text-align: center; font-size: 12px; color: #7f8c8d; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your LeanStock password. Click the button below to set a new password:</p>
            <a href="${resetLink}" class="button">Reset Password</a>
            <p>Or copy this link in your browser:</p>
            <p><code>${resetLink}</code></p>
            <div class="warning">
              <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.
            </div>
            <p>If you did not request a password reset, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 LeanStock. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function businessEventEmailTemplate(data: {
  firstName: string;
  eventType: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  details: Record<string, any>;
}): string {
  const headerBg = data.eventType === 'success' ? '#27ae60' : 
                   data.eventType === 'warning' ? '#f39c12' : '#e74c3c';
  
  let detailsHtml = '';
  if (data.details && Object.keys(data.details).length > 0) {
    detailsHtml = '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">';
    detailsHtml += '<tr style="background: #ecf0f1;"><th style="padding: 10px; text-align: left; border: 1px solid #bdc3c7;">Field</th><th style="padding: 10px; text-align: left; border: 1px solid #bdc3c7;">Value</th></tr>';
    Object.entries(data.details).forEach(([key, value]) => {
      detailsHtml += `<tr><td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>${key}</strong></td><td style="padding: 10px; border: 1px solid #bdc3c7;">${value}</td></tr>`;
    });
    detailsHtml += '</table>';
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${headerBg}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .footer { background: #ecf0f1; padding: 10px; text-align: center; font-size: 12px; color: #7f8c8d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.title}</h1>
          </div>
          <div class="content">
            <p>Hi ${data.firstName},</p>
            <p>${data.message}</p>
            ${detailsHtml}
            <p>For more details, please log in to your <a href="${env.FRONTEND_URL || 'http://localhost:3000'}">LeanStock dashboard</a>.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 LeanStock. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function invitationEmailTemplate(data: {
  firstName: string;
  tenantName: string;
  invitedByName: string;
  inviteLink: string;
  role: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3498db; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .button { display: inline-block; background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { background: #ecf0f1; padding: 10px; text-align: center; font-size: 12px; color: #7f8c8d; }
          .info { background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.firstName},</p>
            <p><strong>${data.invitedByName}</strong> has invited you to join <strong>${data.tenantName}</strong> on LeanStock.</p>
            
            <div class="info">
              <p><strong>Role:</strong> ${data.role}</p>
              <p><strong>Tenant:</strong> ${data.tenantName}</p>
            </div>
            
            <p>Click the button below to accept the invitation and set up your account:</p>
            <a href="${data.inviteLink}" class="button">Accept Invitation</a>
            
            <p>Or copy this link in your browser:</p>
            <p><code>${data.inviteLink}</code></p>
            
            <p><strong>This invitation expires in 7 days.</strong></p>
            <p>If you weren't expecting this invitation, you can ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 LeanStock. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Process individual email job
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<JobResult> {
  const data = job.data;

  logger.info({ 
    jobId: job.id, 
    type: data.type,
    to: (data as any).to,
    tenantId: data.tenantId 
  }, '📧 START processing email job');

  try {
    switch (data.type) {
      case 'SEND_EMAIL': {
        await emailService.send({
          to: data.to,
          subject: data.subject,
          html: data.html,
          text: data.text,
        });
        return { success: true, processedAt: new Date().toISOString() };
      }

      case 'SEND_VERIFICATION': {
        const verificationLink = `${env.FRONTEND_URL || 'http://localhost:3001'}/api/auth/verify-email?token=${data.token}`;
        await emailService.send({
          to: data.to,
          subject: 'Verify your email - LeanStock',
          html: verificationEmailTemplate(data.firstName, verificationLink),
          text: `Hi ${data.firstName},\n\nPlease verify your email by clicking this link: ${verificationLink}\n\nThis link expires in 24 hours.`,
        });
        return { success: true, processedAt: new Date().toISOString() };
      }

      case 'SEND_PASSWORD_RESET': {
        const resetLink = `${env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${data.token}`;
        await emailService.send({
          to: data.to,
          subject: 'Password Reset Request - LeanStock',
          html: passwordResetEmailTemplate(data.firstName, resetLink),
          text: `Hi ${data.firstName},\n\nReset your password by clicking this link: ${resetLink}\n\nThis link expires in 1 hour.`,
        });
        return { success: true, processedAt: new Date().toISOString() };
      }

      case 'SEND_BUSINESS_EVENT': {
        await emailService.send({
          to: data.to,
          subject: data.title,
          html: businessEventEmailTemplate(data),
          text: `Hi ${data.firstName},\n\n${data.message}\n\nDetails: ${JSON.stringify(data.details, null, 2)}`,
        });
        return { success: true, processedAt: new Date().toISOString() };
      }

      case 'SEND_INVITATION': {
        await emailService.send({
          to: data.to,
          subject: `You've been invited to ${data.tenantName} on LeanStock`,
          html: invitationEmailTemplate(data),
          text: `Hi ${data.firstName},\n\n${data.invitedByName} has invited you to join ${data.tenantName} as ${data.role}.\n\nAccept invitation: ${data.inviteLink}\n\nThis invitation expires in 7 days.`,
        });
        return { success: true, processedAt: new Date().toISOString() };
      }

      case 'SEND_BULK_EMAIL': {
        // Process bulk emails with rate limiting
        const results = await Promise.allSettled(
          data.recipients.map(async (recipient) => {
            // Simple template variable replacement
            let html = data.template;
            let subject = data.subject;
            
            if (recipient.variables) {
              Object.entries(recipient.variables).forEach(([key, value]) => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                html = html.replace(regex, String(value));
                subject = subject.replace(regex, String(value));
              });
            }

            await emailService.send({
              to: recipient.to,
              subject,
              html,
            });
          })
        );

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.filter(r => r.status === 'rejected').length;

        logger.info({ 
          jobId: job.id,
          total: data.recipients.length,
          success: successCount,
          failed: failCount 
        }, 'Bulk email job completed');

        return { 
          success: failCount === 0, 
          processedAt: new Date().toISOString() 
        };
      }

      default:
        throw new Error(`Unknown email job type: ${(data as any).type}`);
    }
  } catch (error) {
    logger.error({ 
      err: error, 
      jobId: job.id, 
      type: data.type 
    }, 'Email job processing failed');
    throw error;
  }
}

/**
 * Mail worker instance
 */
export const mailWorker = new Worker<EmailJobData>(
  QUEUE_NAME,
  async (job) => {
    return processEmailJob(job);
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 100,
      duration: 60000, // 100 emails per minute
    },
  }
);

/**
 * Worker event handlers
 */
mailWorker.on('completed', (job, result) => {
  logger.info({ 
    jobId: job.id, 
    type: job.data.type,
    result 
  }, 'Mail job completed');
});

mailWorker.on('failed', (job, err) => {
  logger.error({ 
    err, 
    jobId: job?.id,
    type: job?.data?.type,
    attempts: job?.attemptsMade 
  }, 'Mail job failed');
});

mailWorker.on('error', (err) => {
  logger.error({ err }, 'Mail worker error');
});

/**
 * Add email job to queue
 */
export async function addMailJob(
  data: EmailJobData,
  options?: { delay?: number; jobId?: string }
): Promise<Job> {
  const priority = getPriorityValue(data.priority);
  
  const job = await mailQueue.add(data.type, data, {
    priority,
    ...options,
  });

  logger.debug({ 
    jobId: job.id, 
    type: data.type,
    priority 
  }, 'Mail job added to queue');

  return job;
}

/**
 * Get queue metrics
 */
export async function getMailQueueMetrics(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}> {
  const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
    mailQueue.getWaitingCount(),
    mailQueue.getActiveCount(),
    mailQueue.getCompletedCount(),
    mailQueue.getFailedCount(),
    mailQueue.getDelayedCount(),
    mailQueue.isPaused(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused: isPaused,
  };
}

/**
 * Get failed jobs for inspection/retry
 */
export async function getFailedJobs(start = 0, end = 50): Promise<Job[]> {
  return mailQueue.getFailed(start, end);
}

/**
 * Retry failed job by ID
 */
export async function retryFailedJob(jobId: string): Promise<void> {
  const job = await mailQueue.getJob(jobId);
  if (job) {
    await job.retry();
    logger.info({ jobId }, 'Retrying failed mail job');
  }
}

/**
 * Clean old completed jobs
 */
export async function cleanOldJobs(olderThanHours = 24): Promise<void> {
  await mailQueue.clean(olderThanHours * 60 * 60 * 1000, 100, 'completed');
  await mailQueue.clean(olderThanHours * 60 * 60 * 1000, 100, 'failed');
  logger.info({ olderThanHours }, 'Cleaned old mail jobs');
}

/**
 * Pause/resume queue
 */
export async function pauseMailQueue(): Promise<void> {
  await mailQueue.pause();
  logger.info('Mail queue paused');
}

export async function resumeMailQueue(): Promise<void> {
  await mailQueue.resume();
  logger.info('Mail queue resumed');
}

/**
 * Graceful shutdown
 */
export async function closeMailWorker(): Promise<void> {
  logger.info('Closing mail worker...');
  await mailWorker.close();
  await mailQueue.close();
  logger.info('Mail worker closed');
}
