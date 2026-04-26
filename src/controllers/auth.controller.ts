import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { logger } from '../config/logger';
import { RegisterInput, LoginInput, RefreshInput } from '../schemas/auth.schema';

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const data: RegisterInput = req.body;

      // For super admin registration, tenantId is in body
      // For regular user registration, use tenant from context
      if (!data.tenantId && !req.tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required',
        });
      }

      const user = await authService.register({
        ...data,
        tenantId: data.tenantId || req.tenantId,
      });

      return res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      logger.error({ msg: 'Registration error', error });
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password, tenantId: bodyTenantId } = req.body;
      const tenantId = bodyTenantId || req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required',
        });
      }

      const tokens = await authService.login(email, password, tenantId);

      return res.status(200).json({
        success: true,
        data: tokens,
      });
    } catch (error: any) {
      logger.warn({ msg: 'Login failed', error: error.message });
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body as RefreshInput;

      const tokens = await authService.refresh(refreshToken);

      return res.status(200).json({
        success: true,
        data: tokens,
      });
    } catch (error: any) {
      logger.warn({ msg: 'Token refresh failed', error: error.message });
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      if (refreshToken) {
        await authService.logout(refreshToken, userId);
      }

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error: any) {
      logger.error({ msg: 'Logout error', error });
      return res.status(500).json({
        success: false,
        message: 'Logout failed',
      });
    }
  }
}

export const authController = new AuthController();
export default authController;
