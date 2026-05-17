import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

export const listDeadStockRules = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const rules = await (tenantDb as any).deadStockRule.findMany({
      where: { tenantId },
      orderBy: { daysThreshold: 'asc' },
    });
    res.status(200).json(rules);
  } catch (error: any) {
    logger.error({ err: error }, 'List dead stock rules error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to load rules' });
  }
};

export const createDeadStockRule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { name, daysThreshold, discountPercent, isActive } = req.body;
    const rule = await (tenantDb as any).deadStockRule.create({
      data: { tenantId, name, daysThreshold, discountPercent, isActive },
    });
    logger.info({ ruleId: rule.id }, 'Dead stock rule created');
    res.status(201).json(rule);
  } catch (error: any) {
    logger.error({ err: error }, 'Create dead stock rule error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to create rule' });
  }
};

export const updateDeadStockRule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { name, daysThreshold, discountPercent, isActive } = req.body;
    const rule = await (tenantDb as any).deadStockRule.update({
      where: { id },
      data: { name, daysThreshold, discountPercent, isActive },
    });
    logger.info({ ruleId: id }, 'Dead stock rule updated');
    res.status(200).json(rule);
  } catch (error: any) {
    logger.error({ err: error }, 'Update dead stock rule error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to update rule' });
  }
};

export const deleteDeadStockRule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    await (tenantDb as any).deadStockRule.delete({ where: { id } });
    logger.info({ ruleId: id }, 'Dead stock rule deleted');
    res.status(204).send();
  } catch (error: any) {
    logger.error({ err: error }, 'Delete dead stock rule error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to delete rule' });
  }
};
