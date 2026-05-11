import { Response } from 'express';
import { authService } from '../services/auth.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';
import { RegisterInput, LoginInput, RefreshInput } from '../schemas/auth.schema';

export const register = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body as RegisterInput;
    const user = await authService.register(data, data.tenantId);

    res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Register error');

    if (error.message === 'EMAIL_EXISTS') {
      res.status(409).json({
        code: 'EMAIL_EXISTS',
        message: 'Email already registered in this tenant',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (error.message === 'TENANT_NOT_FOUND') {
      res.status(404).json({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
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
    logger.error({ err: error }, 'Login error');

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
    logger.error({ err: error }, 'Refresh error');

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
    logger.error({ err: error }, 'Logout error');
    // Always return 200 for logout, even on error
    res.status(200).json({
      message: 'Successfully logged out',
    });
  }
};

// TODO: Implement email verification
export const verifyEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    await authService.verifyEmail(token);
    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Email verification error');
    res.status(400).json({ code: 'INVALID_TOKEN', message: 'Invalid or expired token' });
  }
};

// TODO: Implement password reset request
export const requestPasswordReset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, tenantId } = req.body;
    await authService.requestPasswordReset(email, tenantId);
    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    logger.error({ err: error }, 'Password reset request error');
    res.status(200).json({ message: 'If email exists, reset link was sent' });
  }
};

// TODO: Implement password reset
export const resetPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token, newPassword, tenantId } = req.body;
    await authService.resetPassword(token, newPassword, tenantId);
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Password reset error');
    res.status(400).json({ code: 'INVALID_TOKEN', message: 'Invalid or expired token' });
  }
};

// TODO: Implement change password
export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(userId, currentPassword, newPassword);
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Change password error');
    res.status(400).json({ code: 'INVALID_PASSWORD', message: 'Current password is incorrect' });
  }
};

// TODO: Implement resend verification email
export const resendVerificationEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, tenantId } = req.body;
    // TODO: Implement logic
    logger.info({ email, tenantId }, 'Resend verification email requested');
    res.status(200).json({ message: 'If email exists, verification email was sent' });
  } catch (error) {
    logger.error({ err: error }, 'Resend verification email error');
    res.status(200).json({ message: 'If email exists, verification email was sent' });
  }
};
