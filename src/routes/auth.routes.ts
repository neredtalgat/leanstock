import { Router } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';
import { loginSchema, refreshSchema, inviteSchema, registerInviteSchema } from '../schemas/auth.schema';
import { requirePermission } from '../middleware/rbac';

const router = Router();

/**
 * POST /auth/register
 * Public registration is disabled for employee-only system.
 */
router.post('/register', (_req, res) => {
  res.status(403).json({
    code: 'REGISTRATION_DISABLED',
    message: 'Public registration is disabled. Please use invitation flow.',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /auth/login
 * Login with email and password
 */
router.post(
  '/login',
  authRateLimit,
  validate(loginSchema),
  authController.login,
);

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  validate(refreshSchema),
  authController.refresh,
);

/**
 * POST /auth/logout
 * Logout and revoke refresh token
 */
router.post(
  '/logout',
  authenticate,
  authController.logout,
);

/**
 * POST /auth/verify-email
 * Verify email address
 */
router.post(
  '/verify-email',
  authRateLimit,
  validate(z.object({ token: z.string(), tenantId: z.string().optional() })),
  authController.verifyEmail,
);

/**
 * POST /auth/request-password-reset
 * Request password reset email
 */
router.post(
  '/request-password-reset',
  authRateLimit,
  validate(z.object({ email: z.string().email(), tenantId: z.string() })),
  authController.requestPasswordReset,
);

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post(
  '/reset-password',
  authRateLimit,
  validate(z.object({ token: z.string(), newPassword: z.string().min(8), tenantId: z.string() })),
  authController.resetPassword,
);

/**
 * POST /auth/resend-verification
 * Resend verification email
 */
router.post(
  '/resend-verification',
  authRateLimit,
  validate(z.object({ email: z.string().email(), tenantId: z.string() })),
  authController.resendVerificationEmail,
);

/**
 * POST /auth/change-password
 * Change password (authenticated)
 */
router.post(
  '/change-password',
  authenticate,
  validate(z.object({ currentPassword: z.string(), newPassword: z.string().min(8) })),
  authController.changePassword,
);

/**
 * POST /auth/invite
 * Create invitation for a new user (admin only)
 */
router.post(
  '/invite',
  authenticate,
  requirePermission('users:create'),
  validate(inviteSchema),
  authController.inviteUser,
);

/**
 * POST /auth/register-invite
 * Register using invitation token
 */
router.post(
  '/register-invite',
  authRateLimit,
  validate(registerInviteSchema),
  authController.registerByInvite,
);

export default router;
