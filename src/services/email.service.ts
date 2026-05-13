import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Queue } from 'bullmq';
import { redis } from '../config/redis';

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

// Email queue for async processing
const emailQueue = new Queue('email-sending', { connection: redis });

export class EmailService {
  private transporter: nodemailer.Transporter;
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = this.validateEmailConfig();
    
    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false, // Allow self-signed certificates in dev
        },
      });
      
      // Verify connection
      this.transporter.verify((error) => {
        if (error) {
          logger.error({ err: error }, 'SMTP connection failed');
        } else {
          logger.info('SMTP server ready to send emails');
        }
      });
    } else {
      logger.warn('Email service not configured - emails will be logged only');
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
      await emailQueue.add('send-email', data, {
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
    const verificationLink = `${env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    
    await this.queueEmail({
      to,
      subject: 'Verify your email - LeanStock',
      html: this.verificationEmailTemplate(firstName, verificationLink),
      text: `Hi ${firstName},\n\nPlease verify your email by clicking this link: ${verificationLink}\n\nThis link expires in 24 hours.`,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, firstName: string, token: string): Promise<void> {
    const resetLink = `${env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    await this.queueEmail({
      to,
      subject: 'Password Reset Request - LeanStock',
      html: this.passwordResetEmailTemplate(firstName, resetLink),
      text: `Hi ${firstName},\n\nReset your password by clicking this link: ${resetLink}\n\nThis link expires in 1 hour.`,
    });
  }

  /**
   * Send business event notification
   */
  async sendBusinessEvent(data: BusinessEventData): Promise<void> {
    await this.queueEmail({
      to: data.to,
      subject: data.title,
      html: this.businessEventEmailTemplate(data),
      text: `Hi ${data.firstName},\n\n${data.message}\n\nDetails: ${JSON.stringify(data.details, null, 2)}`,
    });
  }

  // ============== Email Templates ==============

  private verificationEmailTemplate(firstName: string, verificationLink: string): string {
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

  private passwordResetEmailTemplate(firstName: string, resetLink: string): string {
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

  private businessEventEmailTemplate(data: BusinessEventData): string {
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
}

export const emailService = new EmailService();
export { emailQueue };
