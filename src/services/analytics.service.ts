import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

interface TenantAnalytics {
  tenantId: string;
  tenantName: string;
  userCount: number;
  productCount: number;
  inventoryCount: number;
  totalInventoryValue: number;
  locationCount: number;
  supplierCount: number;
  purchaseOrderCount: number;
  transferOrderCount: number;
  lowStockCount: number;
  deadStockCount: number;
  lastActivityAt: Date | null;
}

interface SystemMetrics {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalProducts: number;
  totalInventory: number;
  totalInventoryValue: number;
  totalPurchaseOrders: number;
  totalTransfers: number;
}

interface TimeSeriesData {
  date: string;
  newTenants: number;
  newUsers: number;
  newProducts: number;
  purchaseOrders: number;
  transfers: number;
}

class AnalyticsService {
  async getCrossTenantAnalytics(): Promise<TenantAnalytics[]> {
    const prisma = tenantDb as any;

    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            inventory: true,
            locations: true,
            suppliers: true,
            purchaseOrders: true,
            transferOrders: true,
          },
        },
        users: {
          orderBy: { lastLoginAt: 'desc' },
          take: 1,
          select: { lastLoginAt: true },
        },
      },
    });

    const analytics: TenantAnalytics[] = await Promise.all(
      tenants.map(async (tenant: any) => {
        // Calculate total inventory value
        const inventory = await prisma.inventory.findMany({
          where: { tenantId: tenant.id },
          include: {
            product: {
              select: { baseCost: true },
            },
          },
        });

        const totalInventoryValue = inventory.reduce(
          (sum: number, inv: any) => sum + inv.quantity * (inv.product?.baseCost || 0),
          0
        );

        // Count low stock items by comparing inventory quantities to reorder points
        const [tenantInventory, reorderPoints] = await Promise.all([
          prisma.inventory.findMany({
            where: { tenantId: tenant.id },
            select: {
              productId: true,
              locationId: true,
              quantity: true,
            },
          }),
          prisma.reorderPoint.findMany({
            where: { tenantId: tenant.id },
            select: {
              productId: true,
              locationId: true,
              minQuantity: true,
            },
          }),
        ]);

        const inventoryByPair = new Map<string, number>();
        for (const inv of tenantInventory) {
          inventoryByPair.set(`${inv.productId}:${inv.locationId}`, inv.quantity);
        }

        const lowStockCount = reorderPoints.reduce((count: number, rp: any) => {
          const qty = inventoryByPair.get(`${rp.productId}:${rp.locationId}`);
          if (qty !== undefined && qty < rp.minQuantity) {
            return count + 1;
          }
          return count;
        }, 0);

        // Count dead stock items
        const deadStockRules = await prisma.deadStockRule.findFirst({
          where: { tenantId: tenant.id, isActive: true },
        });

        let deadStockCount = 0;
        if (deadStockRules) {
          const thresholdDate = new Date();
          thresholdDate.setDate(thresholdDate.getDate() - deadStockRules.daysThreshold);

          deadStockCount = await prisma.inventory.count({
            where: {
              tenantId: tenant.id,
              lastMovedAt: {
                lt: thresholdDate,
              },
              quantity: {
                gt: 0,
              },
            },
          });
        }

        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          userCount: tenant._count.users,
          productCount: tenant._count.products,
          inventoryCount: tenant._count.inventory,
          totalInventoryValue,
          locationCount: tenant._count.locations,
          supplierCount: tenant._count.suppliers,
          purchaseOrderCount: tenant._count.purchaseOrders,
          transferOrderCount: tenant._count.transferOrders,
          lowStockCount,
          deadStockCount,
          lastActivityAt: tenant.users[0]?.lastLoginAt || null,
        };
      })
    );

    logger.info(`Cross-tenant analytics generated for ${analytics.length} tenants`);
    return analytics;
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const prisma = tenantDb as any;

    const [
      totalTenants,
      activeTenants,
      totalUsers,
      totalProducts,
      totalInventory,
      totalPurchaseOrders,
      totalTransfers,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.product.count(),
      prisma.inventory.count(),
      prisma.purchaseOrder.count(),
      prisma.transferOrder.count(),
    ]);

    // Calculate total inventory value
    const inventory = await prisma.inventory.findMany({
      include: {
        product: {
          select: { baseCost: true },
        },
      },
    });

    const totalInventoryValue = inventory.reduce(
      (sum: number, inv: any) => sum + inv.quantity * (inv.product?.baseCost || 0),
      0
    );

    return {
      totalTenants,
      activeTenants,
      totalUsers,
      totalProducts,
      totalInventory,
      totalInventoryValue,
      totalPurchaseOrders,
      totalTransfers,
    };
  }

  async getTimeSeriesAnalytics(days: number = 30): Promise<TimeSeriesData[]> {
    const prisma = tenantDb as any;
    const result: TimeSeriesData[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [
        newTenants,
        newUsers,
        newProducts,
        purchaseOrders,
        transfers,
      ] = await Promise.all([
        prisma.tenant.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate,
            },
          },
        }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate,
            },
          },
        }),
        prisma.product.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate,
            },
          },
        }),
        prisma.purchaseOrder.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate,
            },
          },
        }),
        prisma.transferOrder.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate,
            },
          },
        }),
      ]);

      result.push({
        date: date.toISOString().split('T')[0],
        newTenants,
        newUsers,
        newProducts,
        purchaseOrders,
        transfers,
      });
    }

    return result;
  }

  async getTenantDetails(tenantId: string) {
    const prisma = tenantDb as any;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            inventory: true,
            locations: true,
            suppliers: true,
            purchaseOrders: true,
            transferOrders: true,
            notifications: true,
            auditLogs: true,
          },
        },
        users: {
          orderBy: { lastLoginAt: 'desc' },
          take: 5,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            lastLoginAt: true,
          },
        },
        locations: {
          take: 5,
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      counts: tenant._count,
      recentUsers: tenant.users,
      locations: tenant.locations,
    };
  }
}

export const analyticsService = new AnalyticsService();
