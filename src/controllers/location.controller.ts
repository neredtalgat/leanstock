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

export const getLocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const location = await locationService.getById(tenantId, id);
    if (!location) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Location not found' });
      return;
    }

    res.status(200).json(location);
  } catch (error) {
    logger.error('Get location error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const updateLocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { name, address, type } = req.body;

    const location = await locationService.update(tenantId, id, { name, address, type });
    res.status(200).json(location);
  } catch (error: any) {
    logger.error('Update location error:', error);
    if (error.message === 'LOCATION_NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Location not found' });
      return;
    }
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const deleteLocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    await locationService.delete(tenantId, id);
    res.status(204).send();
  } catch (error: any) {
    logger.error('Delete location error:', error);
    if (error.message === 'LOCATION_NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Location not found' });
      return;
    }
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};
