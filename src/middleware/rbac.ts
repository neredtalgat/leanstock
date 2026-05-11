import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const roleHierarchy: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.TENANT_ADMIN]: 90,
  [UserRole.REGIONAL_MANAGER]: 70,
  [UserRole.STORE_MANAGER]: 50,
  [UserRole.STORE_ASSOCIATE]: 30,
  [UserRole.SUPPLIER]: 10,
};

export const permissionsMatrix: Record<UserRole, Set<string>> = {
  [UserRole.SUPER_ADMIN]: new Set([
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'tenants:create',
    'tenants:read',
    'tenants:update',
    'tenants:delete',
    'products:create',
    'products:read',
    'products:update',
    'products:delete',
    'suppliers:create',
    'suppliers:update',
    'suppliers:delete',
    'locations:create',
    'locations:update',
    'locations:delete',
    'inventory:read',
    'inventory:create',
    'inventory:update',
    'inventory:delete',
    'inventory:adjust',
    'orders:create',
    'orders:read',
    'orders:update',
    'orders:delete',
    'orders:approve',
    'purchase_orders:create',
    'purchase_orders:update',
    'purchase_orders:receive',
    'reorder-points:create',
    'reorder-points:update',
    'reorder-points:delete',
    'reports:read',
    'notifications:read',
    'analytics:read',
    'system:manage',
    'audit:read',
  ]),
  [UserRole.TENANT_ADMIN]: new Set([
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'products:create',
    'products:read',
    'products:update',
    'products:delete',
    'suppliers:create',
    'suppliers:update',
    'suppliers:delete',
    'locations:create',
    'locations:update',
    'locations:delete',
    'inventory:read',
    'inventory:create',
    'inventory:update',
    'inventory:delete',
    'inventory:adjust',
    'orders:create',
    'orders:read',
    'orders:update',
    'orders:delete',
    'orders:approve',
    'purchase_orders:create',
    'purchase_orders:update',
    'purchase_orders:receive',
    'reorder-points:create',
    'reorder-points:update',
    'reorder-points:delete',
    'reports:read',
    'notifications:read',
    'audit:read',
  ]),
  [UserRole.REGIONAL_MANAGER]: new Set([
    'users:read',
    'products:read',
    'inventory:read',
    'orders:read',
    'reports:read',
    'notifications:read',
    'audit:read',
  ]),
  [UserRole.STORE_MANAGER]: new Set([
    'products:read',
    'inventory:read',
    'inventory:create',
    'inventory:update',
    'inventory:adjust',
    'orders:read',
    'orders:create',
    'purchase_orders:create',
    'purchase_orders:update',
    'purchase_orders:receive',
    'reorder-points:create',
    'reorder-points:update',
    'reports:read',
    'notifications:read',
  ]),
  [UserRole.STORE_ASSOCIATE]: new Set([
    'products:read',
    'inventory:read',
    'orders:read',
    'notifications:read',
  ]),
  [UserRole.SUPPLIER]: new Set([
    'products:read',
    'orders:read',
  ]),
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userPermissions = permissionsMatrix[req.user.role];

      if (!userPermissions || !userPermissions.has(permission)) {
        logger.warn(`Permission denied for user ${req.user.userId}: ${permission}`);
        res.status(403).json({
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource',
          details: { permission },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  };
};

export const requireRole = (minRole: UserRole) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userLevel = roleHierarchy[req.user.role];
      const minLevel = roleHierarchy[minRole];

      if (userLevel < minLevel) {
        logger.warn(`Insufficient role for user ${req.user.userId}: required ${minRole}`);
        res.status(403).json({
          code: 'FORBIDDEN',
          message: 'Insufficient role to access this resource',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Role check error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  };
};
