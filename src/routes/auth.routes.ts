import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';
import { registerSchema, loginSchema, refreshSchema } from '../schemas/auth.schema';

const router = Router();

/**
 * POST /auth/register
 * Register a new user
 */
router.post(
  '/register',
  authRateLimit,
  validate(registerSchema),
  authController.register,
);

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

export default router;
