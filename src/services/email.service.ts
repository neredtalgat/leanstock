import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { mailQueue, type EmailJobData } from '../queues/mail.queue';

interface EmailData {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

interface BusinessEventData {
  to: string;
  firstName: string;
  eventType: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  details: Record<string, any>;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = this.validateEmailConfig();
    
    logger.info({
      isConfigured: this.isConfigured,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      from: env.EMAIL_FROM,
    }, '🔧 EmailService initializing');
    
    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
      
      // Verify connection
      this.transporter.verify((error) => {
        if (error) {
          logger.error({ err: error }, '❌ SMTP connection failed');
        } else {
          logger.info('✅ SMTP server ready to send emails');
        }
      });
    } else {
      logger.warn('⚠️ Email service not configured - emails will be logged only');
    }
  }

  private validateEmailConfig(): boolean {
    return !!(
      env.SMTP_HOST &&
      env.SMTP_USER &&
      env.SMTP_PASS &&
      env.EMAIL_FROM
    );
  }

  /**
   * Send email immediately (synchronous)
   */
  async send(data: EmailData): Promise<void> {
    if (!this.isConfigured) {
      logger.info({ to: data.to, subject: data.subject }, '[EMAIL MOCK] Would send email');
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"LeanStock" <${env.EMAIL_FROM}>`,
        to: data.to,
        subject: data.subject,
        text: data.text,
        html: data.html,
      });

      logger.info({ 
        to: data.to, 
        subject: data.subject,
        messageId: info.messageId 
      }, 'Email sent successfully');
    } catch (error) {
      logger.error({ err: error, to: data.to }, 'Failed to send email');
      throw error;
    }
  }

  /**
   * Queue email for async processing (recommended for API endpoints)
   */
  async queueEmail(data: EmailData): Promise<void> {
    try {
      const jobData: EmailJobData = {
        type: 'SEND_EMAIL',
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
      };
      await mailQueue.add('SEND_EMAIL', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });
      logger.debug({ to: data.to, subject: data.subject }, 'Email queued');
    } catch (error) {
      logger.error({ err: error }, 'Failed to queue email');
      throw error;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(to: string, firstName: string, token: string): Promise<void> {
    try {
      const jobData: EmailJobData = {
        type: 'SEND_VERIFICATION',
        to,
        firstName: firstName || 'User',
        token,
      };
      await mailQueue.add('SEND_VERIFICATION', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });
      logger.debug({ to }, 'Verification email queued');
    } catch (error) {
      logger.error({ err: error, to }, 'Failed to queue verification email');
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, firstName: string, token: string): Promise<void> {
    try {
      const jobData: EmailJobData = {
        type: 'SEND_PASSWORD_RESET',
        to,
        firstName: firstName || 'User',
        token,
      };
      await mailQueue.add('SEND_PASSWORD_RESET', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });
      logger.debug({ to }, 'Password reset email queued');
    } catch (error) {
      logger.error({ err: error, to }, 'Failed to queue password reset email');
      throw error;
    }
  }

  /**
   * Send business event notification
   */
  async sendBusinessEvent(data: BusinessEventData): Promise<void> {
    try {
      const jobData: EmailJobData = {
        type: 'SEND_BUSINESS_EVENT',
        to: data.to,
        firstName: data.firstName,
        eventType: data.eventType,
        title: data.title,
        message: data.message,
        details: data.details,
      };
      await mailQueue.add('SEND_BUSINESS_EVENT', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });
      logger.debug({ to: data.to, title: data.title }, 'Business event email queued');
    } catch (error) {
      logger.error({ err: error, to: data.to }, 'Failed to queue business event email');
      throw error;
    }
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(data: {
    to: string;
    firstName: string;
    tenantName: string;
    invitedByName: string;
    inviteLink: string;
    role: string;
  }): Promise<void> {
    try {
      const jobData: EmailJobData = {
        type: 'SEND_INVITATION',
        to: data.to,
        firstName: data.firstName,
        tenantName: data.tenantName,
        invitedByName: data.invitedByName,
        inviteLink: data.inviteLink,
        role: data.role,
      };
      await mailQueue.add('SEND_INVITATION', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });
      logger.debug({ to: data.to, tenantName: data.tenantName }, 'Invitation email queued');
    } catch (error) {
      logger.error({ err: error, to: data.to }, 'Failed to queue invitation email');
      throw error;
    }
  }
}

export const emailService = new EmailService();
export { mailQueue };
