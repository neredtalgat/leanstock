import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { tenantDb } from '../config/database';
import { logger } from '../config/logger';
import { authService } from '../services/auth.service';

export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId;
    const role = req.query.role as string;
    
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (role) where.role = role;
    
    const users = await tenantDb.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.status(200).json({ data: users });
  } catch (error) {
    logger.error({ err: error }, 'Get users error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch users' });
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, role } = req.body;
    const tenantId = req.tenantId;
    const invitedBy = req.user!;

    if (!tenantId) {
      res.status(400).json({ code: 'MISSING_TENANT', message: 'Tenant required' });
      return;
    }
    await authService.createInvitation(invitedBy, email, role);

    res.status(201).json({
      email,
      role,
      message: 'User created and invitation sent',
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Create user error');

    if (error.message === 'EMAIL_EXISTS') {
      res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email already registered in this tenant' });
      return;
    }
    if (error.message === 'INVITE_ROLE_FORBIDDEN') {
      res.status(403).json({ code: 'INVITE_ROLE_FORBIDDEN', message: 'You cannot invite this role' });
      return;
    }
    if (error.message === 'TENANT_NOT_FOUND') {
      res.status(404).json({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
      return;
    }

    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to create user' });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, isActive } = req.body;
    const tenantId = req.tenantId;

    const user = await tenantDb.user.updateMany({
      where: { id, tenantId },
      data: { firstName, lastName, role, isActive },
    });

    res.status(200).json({ message: 'User updated', count: user.count });
  } catch (error) {
    logger.error({ err: error }, 'Update user error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to update user' });
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    await tenantDb.user.deleteMany({ where: { id, tenantId } });
    res.status(200).json({ message: 'User deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Delete user error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to delete user' });
  }
};
