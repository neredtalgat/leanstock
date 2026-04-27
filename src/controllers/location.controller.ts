import { Response } from 'express';
import { locationService } from '../services/location.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const listLocations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const locations = await locationService.list(tenantId);
    res.status(200).json(locations);
  } catch (error) {
    logger.error('List locations error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const createLocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { name, address, type } = req.body;

    const location = await locationService.create(tenantId, { name, address, type });
    res.status(201).json(location);
  } catch (error) {
    logger.error('Create location error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};
