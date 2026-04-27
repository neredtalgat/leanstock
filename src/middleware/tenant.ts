import { Response, NextFunction } from 'express';
import { asyncLocalStorage } from '../config/database';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';
import { UserRole } from '@prisma/client';

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const injectTenant = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const store: Record<string, unknown> = {};

    // Get tenant from JWT or header
    let tenantId = req.user?.tenantId;

    if (!tenantId) {
      const headerTenant = req.headers['x-tenant-id'] as string;
      if (headerTenant) {
        tenantId = headerTenant;
      }
    }

    if (!tenantId) {
      res.status(400).json({
        code: 'MISSING_TENANT',
        message: 'Missing tenant ID',
        details: {
          hint: 'Provide X-Tenant-ID header or use JWT with tenant context',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Validate tenant UUID
    if (!UUID_REGEX.test(tenantId)) {
      res.status(400).json({
        code: 'INVALID_TENANT',
        message: 'Invalid tenant ID format',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    store.tenantId = tenantId;

    // Check if user is super admin
    if (req.user?.role === UserRole.SUPER_ADMIN) {
      store.isSuperAdmin = true;
    }

    asyncLocalStorage.run(store as any, () => {
      req.tenantId = tenantId;
      next();
    });
  } catch (error) {
    logger.error('Tenant injection error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};
