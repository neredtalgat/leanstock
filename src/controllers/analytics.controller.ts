import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const getCrossTenantAnalytics = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const analytics = await analyticsService.getCrossTenantAnalytics();
    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error({ err: error }, 'Cross-tenant analytics error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to generate cross-tenant analytics',
      timestamp: new Date().toISOString(),
    });
  }
};

export const getSystemMetrics = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const metrics = await analyticsService.getSystemMetrics();
    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error({ err: error }, 'System metrics error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to generate system metrics',
      timestamp: new Date().toISOString(),
    });
  }
};

export const getTimeSeriesAnalytics = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await analyticsService.getTimeSeriesAnalytics(days);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error({ err: error }, 'Time series analytics error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to generate time series analytics',
      timestamp: new Date().toISOString(),
    });
  }
};

export const getTenantDetails = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { tenantId } = req.params;
    const details = await analyticsService.getTenantDetails(tenantId);
    res.status(200).json({
      success: true,
      data: details,
    });
  } catch (error) {
    logger.error({ err: error }, 'Tenant details error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get tenant details',
      timestamp: new Date().toISOString(),
    });
  }
};
