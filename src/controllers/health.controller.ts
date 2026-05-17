import { Request, Response } from 'express';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { getJobsHealth } from '../jobs';

export async function healthCheck(req: Request, res: Response): Promise<void> {
  const checks: Record<string, { status: string; responseTime?: number; error?: string }> = {};
  let overallStatus = 'healthy';

  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', responseTime: Date.now() - start };
  } catch (error: any) {
    checks.database = { status: 'unhealthy', error: error.message };
    overallStatus = 'unhealthy';
  }

  try {
    const start = Date.now();
    await redis.ping();
    checks.redis = { status: 'healthy', responseTime: Date.now() - start };
  } catch (error: any) {
    checks.redis = { status: 'unhealthy', error: error.message };
    overallStatus = 'unhealthy';
  }

  try {
    await getJobsHealth();
    checks.workers = { status: 'healthy' };
  } catch (error: any) {
    checks.workers = { status: 'unhealthy', error: error.message };
    overallStatus = 'unhealthy';
  }

  const statusCode = overallStatus === 'healthy' ? 200 : 503;
  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    checks,
  });
}

export async function readinessCheck(req: Request, res: Response): Promise<void> {
  try {
    await db.$queryRaw`SELECT 1`;
    await redis.ping();
    res.status(200).json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
}
