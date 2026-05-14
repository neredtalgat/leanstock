import { Response } from 'express';
import { systemSettingsService } from '../services/system-settings.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';
import { getJobsHealth, getFailedJobs, retryFailedJob, cleanOldJobs } from '../jobs';
import { emailService } from '../services/email.service';

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

/**
 * Get mail queue health metrics
 */
export const getMailQueueStatus = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const health = await getJobsHealth();
    res.status(200).json({
      success: true,
      data: health.mail,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get mail queue status error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get mail queue status',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get failed mail jobs
 */
export const getFailedMailJobs = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const start = parseInt(req.query.start as string) || 0;
    const end = parseInt(req.query.end as string) || 50;
    const jobs = await getFailedJobs(start, end);
    
    res.status(200).json({
      success: true,
      data: jobs.map(j => ({
        id: j.id,
        name: j.name,
        data: j.data,
        failedReason: j.failedReason,
        attemptsMade: j.attemptsMade,
        createdAt: j.timestamp,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Get failed mail jobs error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get failed mail jobs',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Retry a failed mail job
 */
export const retryMailJob = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { jobId } = req.params;
    await retryFailedJob(jobId);
    res.status(200).json({
      success: true,
      message: `Job ${jobId} queued for retry`,
    });
  } catch (error) {
    logger.error({ err: error, jobId: req.params.jobId }, 'Retry mail job error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to retry mail job',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Clean old completed mail jobs
 */
export const cleanMailJobs = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    await cleanOldJobs(hours);
    res.status(200).json({
      success: true,
      message: `Cleaned jobs older than ${hours} hours`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Clean mail jobs error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to clean mail jobs',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Test SMTP configuration by sending a test email
 */
export const testSmtp = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { to } = req.body;
    const testEmail = to || 'test@example.com';
    
    logger.info({ to: testEmail }, 'Sending test email');
    
    await emailService.send({
      to: testEmail,
      subject: 'Test Email from LeanStock',
      html: '<h1>Test Email</h1><p>If you see this, SMTP is working!</p>',
      text: 'Test Email - If you see this, SMTP is working!',
    });
    
    res.status(200).json({
      success: true,
      message: `Test email sent to ${testEmail}`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Test SMTP failed');
    res.status(500).json({
      code: 'SMTP_ERROR',
      message: error instanceof Error ? error.message : 'Failed to send test email',
      timestamp: new Date().toISOString(),
    });
  }
};
