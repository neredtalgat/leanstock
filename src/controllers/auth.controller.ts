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
      emailVerified: user.emailVerified,
      message: 'Registration successful. Please check your email to verify your account.',
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

    if (error.message === 'INVITE_ROLE_FORBIDDEN') {
      res.status(403).json({
        code: 'INVITE_ROLE_FORBIDDEN',
        message: 'You cannot invite this role',
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

    if (error.message === 'EMAIL_NOT_VERIFIED') {
      res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in',
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

export const verifyEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    
    if (!token) {
      res.status(400).json({ 
        code: 'MISSING_TOKEN', 
        message: 'Verification token is required' 
      });
      return;
    }
    
    await authService.verifyEmail(token);
    res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error: any) {
    logger.error({ err: error }, 'Email verification error');
    
    if (error.message === 'INVALID_TOKEN') {
      res.status(400).json({ 
        code: 'INVALID_TOKEN', 
        message: 'Invalid or expired verification token' 
      });
      return;
    }
    
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Failed to verify email' 
    });
  }
};

export const requestPasswordReset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, tenantId } = req.body;
    
    if (!email || !tenantId) {
      res.status(400).json({ 
        code: 'MISSING_FIELDS', 
        message: 'Email and tenantId are required' 
      });
      return;
    }
    
    await authService.requestPasswordReset(email, tenantId);
    // Always return success to prevent email enumeration
    res.status(200).json({ 
      message: 'If the email exists, a password reset link has been sent.' 
    });
  } catch (error) {
    logger.error({ err: error }, 'Password reset request error');
    // Always return success
    res.status(200).json({ 
      message: 'If the email exists, a password reset link has been sent.' 
    });
  }
};

export const resetPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token, newPassword, tenantId } = req.body;
    
    if (!token || !newPassword || !tenantId) {
      res.status(400).json({ 
        code: 'MISSING_FIELDS', 
        message: 'Token, newPassword, and tenantId are required' 
      });
      return;
    }
    
    await authService.resetPassword(token, newPassword, tenantId);
    res.status(200).json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (error: any) {
    logger.error({ err: error }, 'Password reset error');
    
    if (error.message === 'INVALID_TOKEN') {
      res.status(400).json({ 
        code: 'INVALID_TOKEN', 
        message: 'Invalid or expired reset token' 
      });
      return;
    }
    
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Failed to reset password' 
    });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      res.status(400).json({ 
        code: 'MISSING_FIELDS', 
        message: 'Current password and new password are required' 
      });
      return;
    }
    
    await authService.changePassword(userId, currentPassword, newPassword);
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error: any) {
    logger.error({ err: error }, 'Change password error');
    
    if (error.message === 'INVALID_PASSWORD') {
      res.status(400).json({ 
        code: 'INVALID_PASSWORD', 
        message: 'Current password is incorrect' 
      });
      return;
    }
    
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ 
        code: 'USER_NOT_FOUND', 
        message: 'User not found' 
      });
      return;
    }
    
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Failed to change password' 
    });
  }
};

export const resendVerificationEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, tenantId } = req.body;
    
    if (!email || !tenantId) {
      res.status(400).json({ 
        code: 'MISSING_FIELDS', 
        message: 'Email and tenantId are required' 
      });
      return;
    }
    
    await authService.resendVerificationEmail(email, tenantId);
    // Always return success to prevent email enumeration
    res.status(200).json({ 
      message: 'If the email exists and is not verified, a verification email has been sent.' 
    });
  } catch (error) {
    logger.error({ err: error }, 'Resend verification email error');
    // Always return success
    res.status(200).json({ 
      message: 'If the email exists and is not verified, a verification email has been sent.' 
    });
  }
};

export const inviteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, role } = req.body;
    const invitedBy = req.user!;

    const token = await authService.createInvitation(invitedBy, email, role);

    res.status(201).json({
      inviteToken: token,
      inviteLink: `http://localhost:3000/auth/register-invite?token=${token}`,
      message: 'Invitation created successfully',
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Invite user error');

    if (error.message === 'TENANT_NOT_FOUND') {
      res.status(404).json({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

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
      message: 'Failed to create invitation',
      timestamp: new Date().toISOString(),
    });
  }
};

export const registerByInvite = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token, password, firstName, lastName } = req.body;

    const { user, tokens } = await authService.acceptInvitation(token, password, firstName, lastName);

    res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      message: 'Registration successful. You are now logged in.',
      createdAt: user.createdAt,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Register by invite error');

    if (error.message === 'INVALID_INVITE_TOKEN') {
      res.status(400).json({
        code: 'INVALID_INVITE_TOKEN',
        message: 'Invalid or expired invitation token',
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

    if (error.message === 'EMAIL_EXISTS') {
      res.status(409).json({
        code: 'EMAIL_EXISTS',
        message: 'Email already registered',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Registration failed',
      timestamp: new Date().toISOString(),
    });
  }
};
