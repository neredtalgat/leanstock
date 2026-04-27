import { Response } from 'express';
import { authService } from '../services/auth.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';
import { RegisterInput, LoginInput, RefreshInput } from '../schemas/auth.schema';

export const register = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body as RegisterInput;
    let tenantId = data.tenantId;

    // If no tenant provided, ensure user is super admin or deny
    if (!tenantId) {
      if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        res.status(403).json({
          code: 'FORBIDDEN',
          message: 'Only super admin can register users without tenant',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    } else {
      tenantId = data.tenantId;
    }

    const user = await authService.register(data, tenantId!);

    res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error: any) {
    logger.error('Register error:', error);

    if (error.message === 'EMAIL_EXISTS') {
      res.status(409).json({
        code: 'EMAIL_EXISTS',
        message: 'Email already registered in this tenant',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

export const login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body as LoginInput;

    const tokenPair = await authService.login(data);

    res.status(200).json({
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
      tokenType: 'Bearer',
    });
  } catch (error: any) {
    logger.error('Login error:', error);

    if (error.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

export const refresh = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body as RefreshInput;

    const tokenPair = await authService.refresh(data.refreshToken);

    res.status(200).json({
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
      tokenType: 'Bearer',
    });
  } catch (error: any) {
    logger.error('Refresh error:', error);

    const errorMessages: Record<string, { code: string; message: string; status: number }> = {
      INVALID_TOKEN_TYPE: { code: 'INVALID_TOKEN_TYPE', message: 'Invalid token type', status: 401 },
      TOKEN_REVOKED: { code: 'TOKEN_REVOKED', message: 'Token has been revoked', status: 401 },
      USER_NOT_FOUND: { code: 'USER_NOT_FOUND', message: 'User not found', status: 401 },
    };

    const errorInfo = errorMessages[error.message];
    if (errorInfo) {
      res.status(errorInfo.status).json({
        code: errorInfo.code,
        message: errorInfo.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(401).json({
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired refresh token',
      timestamp: new Date().toISOString(),
    });
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const refreshToken = req.body.refreshToken as string;

    if (!refreshToken) {
      res.status(400).json({
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await authService.logout(refreshToken);

    res.status(200).json({
      message: 'Successfully logged out',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    // Always return 200 for logout, even on error
    res.status(200).json({
      message: 'Successfully logged out',
    });
  }
};
