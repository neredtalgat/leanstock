import { Queue } from 'bullmq';
import { redis } from '../config/redis';

/**
 * Email job types supported by the mail worker
 */
export type EmailJobType = 
  | 'SEND_EMAIL'
  | 'SEND_VERIFICATION'
  | 'SEND_PASSWORD_RESET'
  | 'SEND_BUSINESS_EVENT'
  | 'SEND_BULK_EMAIL'
  | 'SEND_INVITATION';

/**
 * Base email job data
 */
export interface BaseEmailJob {
  type: EmailJobType;
  tenantId?: string;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Simple email job
 */
export interface SendEmailJob extends BaseEmailJob {
  type: 'SEND_EMAIL';
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

/**
 * Verification email job
 */
export interface SendVerificationJob extends BaseEmailJob {
  type: 'SEND_VERIFICATION';
  to: string;
  firstName: string;
  token: string;
}

/**
 * Password reset email job
 */
export interface SendPasswordResetJob extends BaseEmailJob {
  type: 'SEND_PASSWORD_RESET';
  to: string;
  firstName: string;
  token: string;
}

/**
 * Business event email job
 */
export interface SendBusinessEventJob extends BaseEmailJob {
  type: 'SEND_BUSINESS_EVENT';
  to: string;
  firstName: string;
  eventType: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  details: Record<string, any>;
}

/**
 * Bulk email job
 */
export interface SendBulkEmailJob extends BaseEmailJob {
  type: 'SEND_BULK_EMAIL';
  recipients: Array<{
    to: string;
    firstName: string;
    variables?: Record<string, any>;
  }>;
  subject: string;
  template: string;
}

/**
 * Invitation email job
 */
export interface SendInvitationJob extends BaseEmailJob {
  type: 'SEND_INVITATION';
  to: string;
  firstName: string;
  tenantName: string;
  invitedByName: string;
  inviteLink: string;
  role: string;
}

export type EmailJobData = 
  | SendEmailJob 
  | SendVerificationJob 
  | SendPasswordResetJob 
  | SendBusinessEventJob 
  | SendBulkEmailJob
  | SendInvitationJob;

/**
 * Queue name for email jobs
 */
const QUEUE_NAME = 'mail-queue';

/**
 * Mail queue for adding jobs
 */
export const mailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
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
