import { Request, Response } from 'express';
import { systemSettingsService } from '../services/system-settings.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const getGlobalLimits = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const limits = await systemSettingsService.getGlobalLimits();
    res.status(200).json({
      success: true,
      data: limits,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get global limits error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get global limits',
      timestamp: new Date().toISOString(),
    });
  }
};

export const updateGlobalLimits = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const limits = req.body;
    const updatedLimits = await systemSettingsService.updateGlobalLimits(limits);
    res.status(200).json({
      success: true,
      data: updatedLimits,
    });
  } catch (error) {
    logger.error({ err: error }, 'Update global limits error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update global limits',
      timestamp: new Date().toISOString(),
    });
  }
};

export const getTenantLimits = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { tenantId } = req.params;
    const limits = await systemSettingsService.checkTenantLimits(tenantId);
    res.status(200).json({
      success: true,
      data: limits,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get tenant limits error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get tenant limits',
      timestamp: new Date().toISOString(),
    });
  }
};

export const getSystemStatus = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const status = await systemSettingsService.getSystemStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get system status error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get system status',
      timestamp: new Date().toISOString(),
    });
  }
};
