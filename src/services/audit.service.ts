import { tenantDb } from '../config/database';

export interface ListAuditFilters {
  productId?: string;
  userId?: string;
  action?: string;
  limit?: number;
}

class AuditService {
  async list(tenantId: string, filters: ListAuditFilters) {
    const where: any = { tenantId };

    if (filters.productId) {
      // Filter by product-related audit logs
      where.OR = [
        { entityType: 'Product', entityId: filters.productId },
        { entityType: 'Inventory', newValues: { productId: filters.productId } },
      ];
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    const logs = await (tenantDb as any).auditLog.findMany({
      where,
      take: filters.limit || 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return logs.map((log: any) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldValues: log.oldValues,
      newValues: log.newValues,
      user: log.user,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    }));
  }
}

export const auditService = new AuditService();
