import { prisma } from '../config/database';
import { logger } from '../config/logger';

export async function createAuditLog(data: {
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  changes?: any;
  status: string;
  details?: string;
  ip?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        changes: data.changes ? JSON.stringify(data.changes) : null,
        status: data.status,
        details: data.details,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to create audit log',
      error,
      data,
    });
  }
}

export default createAuditLog;
