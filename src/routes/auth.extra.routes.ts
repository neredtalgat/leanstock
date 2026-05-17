import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { z } from 'zod';
import { tenantDb } from '../config/database';
import { emailService } from '../services/email.service';
import { logger } from '../config/logger';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = Router();

const ForgotPasswordSchema = z.object({ email: z.string().email() });
const ResetPasswordSchema = z.object({ token: z.string().min(1), newPassword: z.string().min(8) });
const VerifyEmailSchema = z.object({ token: z.string().min(1) });

/**
 * POST /auth/forgot-password
 * Send password reset email
 */
router.post('/forgot-password', validate(ForgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body;
    const user = await (tenantDb as any).user.findFirst({ where: { email } });

    if (!user) {
      // Return success even if user not found (security)
      return res.status(200).json({ message: 'If an account exists, a reset link has been sent' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await (tenantDb as any).user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await emailService.sendPasswordResetEmail(user.email, user.firstName || 'User', token);

    logger.info({ email }, 'Password reset email queued');
    res.status(200).json({ message: 'If an account exists, a reset link has been sent' });
  } catch (error: any) {
    logger.error({ err: error }, 'Forgot password error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to process request' });
  }
});

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', validate(ResetPasswordSchema), async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await (tenantDb as any).user.findFirst({
      where: { passwordResetToken: token, passwordResetExpires: { gt: new Date() } },
    });

    if (!user) {
      return res.status(400).json({ code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    await (tenantDb as any).user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    });

    logger.info({ userId: user.id }, 'Password reset successful');
    res.status(200).json({ message: 'Password reset successful. Please log in.' });
  } catch (error: any) {
    logger.error({ err: error }, 'Reset password error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to reset password' });
  }
});

/**
 * GET /auth/verify-email?token=...
 * Verify email address
 */
router.get('/verify-email', async (req, res) => {
  try {
    const token = req.query.token as string;
    const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    if (!token) {
      return res.redirect(`${redirectUrl}/?verify=error&message=${encodeURIComponent('Token required')}`);
    }

    const user = await (tenantDb as any).user.findFirst({
      where: { emailVerificationToken: token, emailVerificationExpires: { gt: new Date() } },
    });

    if (!user) {
      return res.redirect(`${redirectUrl}/?verify=error&message=${encodeURIComponent('Invalid or expired token')}`);
    }

    await (tenantDb as any).user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerificationToken: null, emailVerificationExpires: null },
    });

    logger.info({ userId: user.id }, 'Email verified');
    return res.redirect(`${redirectUrl}/?verify=success&message=${encodeURIComponent('Email verified! You can now log in.')}`);
  } catch (error: any) {
    logger.error({ err: error }, 'Verify email error');
    const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(`${redirectUrl}/?verify=error&message=${encodeURIComponent('Failed to verify email')}`);
  }
});

/**
 * POST /auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await (tenantDb as any).user.findFirst({ where: { email } });

    if (!user || user.emailVerified) {
      return res.status(200).json({ message: 'If eligible, a verification email has been sent' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 3600000); // 24 hours

    await (tenantDb as any).user.update({
      where: { id: user.id },
      data: { emailVerificationToken: token, emailVerificationExpires: expires },
    });

    await emailService.sendVerificationEmail(user.email, user.firstName || 'User', token);
    logger.info({ email }, 'Verification email resent');
    res.status(200).json({ message: 'If eligible, a verification email has been sent' });
  } catch (error: any) {
    logger.error({ err: error }, 'Resend verification error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to resend verification' });
  }
});

export default router;
