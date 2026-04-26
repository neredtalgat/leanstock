import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from '../schemas/auth.schema';

const router = Router();

/**
 * POST /auth/register
 * Register a new user
 */
router.post(
  '/register',
  authRateLimit,
  validate(registerSchema),
  (req, res) => authController.register(req, res)
);

/**
 * POST /auth/login
 * Login and get access/refresh tokens
 */
router.post(
  '/login',
  authRateLimit,
  validate(loginSchema),
  (req, res) => authController.login(req, res)
);

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  validate(refreshSchema),
  (req, res) => authController.refresh(req, res)
);

/**
 * POST /auth/logout
 * Logout and revoke tokens
 */
router.post(
  '/logout',
  authenticate,
  validate(logoutSchema),
  (req, res) => authController.logout(req, res)
);

export default router;
