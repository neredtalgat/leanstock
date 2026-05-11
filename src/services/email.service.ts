import { logger } from '../config/logger';

interface EmailData {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export class EmailService {
  async send(data: EmailData): Promise<void> {
    // TODO: Implement actual email sending with SMTP provider
    logger.info({ to: data.to, subject: data.subject }, 'Email would be sent');
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    await this.send({
      to,
      subject: 'Verify your email',
      text: `Your verification token: ${token}`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    await this.send({
      to,
      subject: 'Password reset request',
      text: `Your password reset token: ${token}`,
    });
  }
}

export const emailService = new EmailService();
