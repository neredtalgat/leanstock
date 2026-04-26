import { Request, Response, NextFunction } from 'express';
import { asyncLocalStorage } from '../config/database';

export interface RBACPermission {
  [key: string]: string[];
}

const roleHierarchy: { [key: string]: number } = {
  SUPER_ADMIN: 100,
  TENANT_ADMIN: 90,
  REGIONAL_MANAGER: 70,
  STORE_MANAGER: 50,
  STORE_ASSOCIATE: 30,
  SUPPLIER: 10,
};

const permissionsMatrix: RBACPermission = {
  SUPER_ADMIN: ['*'],
  TENANT_ADMIN: [
    'products:create',
    'products:read',
    'products:update',
    'products:delete',
    'inventory:read',
    'inventory:update',
    'transfers:create',
    'transfers:approve',
    'transfers:ship',
    'transfers:receive',
    'users:create',
    'users:read',
    'users:update',
    'reports:read',
  ],
  REGIONAL_MANAGER: [
    'products:read',
    'inventory:read',
    'inventory:update',
    'transfers:create',
    'transfers:approve',
    'transfers:ship',
    'transfers:receive',
    'reports:read',
  ],
  STORE_MANAGER: [
    'products:read',
    'inventory:read',
    'inventory:update',
    'transfers:create',
    'transfers:ship',
    'transfers:receive',
    'reports:read',
  ],
  STORE_ASSOCIATE: [
    'products:read',
    'inventory:read',
  ],
  SUPPLIER: [
    'products:read',
    'reports:read',
  ],
};

export const requireRole = (minRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const userLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevel = roleHierarchy[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden - insufficient role',
      });
    }

    asyncLocalStorage.run(
      {
        tenantId: req.user.tenantId,
        userId: req.user.id,
        role: req.user.role,
        isSuperAdmin: req.user.role === 'SUPER_ADMIN',
      },
      () => next()
    );
  };
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const userPermissions = permissionsMatrix[req.user.role] || [];

    if (userPermissions.includes('*') || userPermissions.includes(permission)) {
      asyncLocalStorage.run(
        {
          tenantId: req.user.tenantId,
          userId: req.user.id,
          role: req.user.role,
          isSuperAdmin: req.user.role === 'SUPER_ADMIN',
        },
        () => next()
      );
    } else {
      return res.status(403).json({
        success: false,
        message: 'Forbidden - insufficient permissions',
      });
    }
  };
};

export const injectTenant = (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      message: 'Tenant ID is required',
    });
  }

  asyncLocalStorage.run(
    {
      tenantId,
      userId: req.user?.id,
      role: req.user?.role,
      isSuperAdmin: req.user?.role === 'SUPER_ADMIN',
    },
    () => next()
  );
};

export default {
  requireRole,
  requirePermission,
  injectTenant,
};
