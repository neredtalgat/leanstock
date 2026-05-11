import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { tenantService } from '../services/tenant.service';
import { CreateTenantInput } from '../schemas/tenant.schema';
import { logger } from '../config/logger';

export const createTenant = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body as CreateTenantInput;
    const tenant = await tenantService.create(data);

    res.status(201).json({
      id: tenant.id,
      name: tenant.name,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    });
  } catch (error) {
    logger.error({ err: error }, 'Create tenant error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};
