import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

interface GlobalLimits {
  maxTenants: number;
  maxUsersPerTenant: number;
  maxProductsPerTenant: number;
  maxLocationsPerTenant: number;
  maxSkuPerTenant: number;
  apiRateLimitPerMinute: number;
  apiRateLimitPerHour: number;
  maxFileUploadSize: number;
  maxStoragePerTenant: number;
}

// SystemSetting interface defined in Prisma schema

const DEFAULT_LIMITS: GlobalLimits = {
  maxTenants: 1000,
  maxUsersPerTenant: 100,
  maxProductsPerTenant: 10000,
  maxLocationsPerTenant: 100,
  maxSkuPerTenant: 50000,
  apiRateLimitPerMinute: 100,
  apiRateLimitPerHour: 1000,
  maxFileUploadSize: 10 * 1024 * 1024, // 10MB
  maxStoragePerTenant: 1024 * 1024 * 1024, // 1GB
};

class SystemSettingsService {
  async getGlobalLimits(): Promise<GlobalLimits> {
    const prisma = tenantDb as any;

    const settings = await prisma.systemSetting?.findMany({
      where: {
        key: {
          startsWith: 'limit.',
        },
      },
    });

    if (!settings || settings.length === 0) {
      return DEFAULT_LIMITS;
    }

    const limits: Partial<GlobalLimits> = {};
    for (const setting of settings) {
      const key = setting.key.replace('limit.', '') as keyof GlobalLimits;
      if (key in DEFAULT_LIMITS) {
        (limits as any)[key] = parseInt(setting.value, 10);
      }
    }

    return { ...DEFAULT_LIMITS, ...limits };
  }

  async updateGlobalLimits(limits: Partial<GlobalLimits>): Promise<GlobalLimits> {
    const prisma = tenantDb as any;

    // Check if system settings table exists
    try {
      for (const [key, value] of Object.entries(limits)) {
        const settingKey = `limit.${key}`;
        await prisma.systemSetting?.upsert({
          where: { key: settingKey },
          update: {
            value: value.toString(),
          },
          create: {
            key: settingKey,
            value: value.toString(),
            description: `Global limit for ${key}`,
          },
        });
      }

      logger.info('Global limits updated:', limits);
      return this.getGlobalLimits();
    } catch (error) {
      // If table doesn't exist, just return the new limits
      logger.warn('System settings table may not exist, returning provided limits');
      return { ...DEFAULT_LIMITS, ...limits };
    }
  }

  async checkTenantLimits(tenantId: string): Promise<{
    canCreateUser: boolean;
    canCreateProduct: boolean;
    canCreateLocation: boolean;
    currentUsers: number;
    currentProducts: number;
    currentLocations: number;
    limits: GlobalLimits;
  }> {
    const prisma = tenantDb as any;
    const limits = await this.getGlobalLimits();

    const [
      currentUsers,
      currentProducts,
      currentLocations,
    ] = await Promise.all([
      prisma.user.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      prisma.location.count({ where: { tenantId } }),
    ]);

    return {
      canCreateUser: currentUsers < limits.maxUsersPerTenant,
      canCreateProduct: currentProducts < limits.maxProductsPerTenant,
      canCreateLocation: currentLocations < limits.maxLocationsPerTenant,
      currentUsers,
      currentProducts,
      currentLocations,
      limits,
    };
  }

  async getSystemStatus(): Promise<{
    totalTenants: number;
    maxTenants: number;
    storageUsed: number;
    maxStorage: number;
    apiCallsLastHour: number;
    isHealthy: boolean;
  }> {
    const prisma = tenantDb as any;
    const limits = await this.getGlobalLimits();

    const totalTenants = await prisma.tenant.count();

    // This would need to be tracked in a real system
    // For now, returning placeholder values
    return {
      totalTenants,
      maxTenants: limits.maxTenants,
      storageUsed: 0, // Would need to calculate from file storage
      maxStorage: limits.maxTenants * limits.maxStoragePerTenant,
      apiCallsLastHour: 0, // Would need to track via middleware
      isHealthy: totalTenants < limits.maxTenants,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validateApiRequest(_tenantId: string): Promise<{
    allowed: boolean;
    remainingRequests: number;
    resetTime: Date;
  }> {
    const limits = await this.getGlobalLimits();

    // This would need Redis or in-memory store for rate limiting
    // For now, returning placeholder
    return {
      allowed: true,
      remainingRequests: limits.apiRateLimitPerMinute,
      resetTime: new Date(Date.now() + 60000),
    };
  }
}

export const systemSettingsService = new SystemSettingsService();
