import { db } from '../config/database';
import { CreateTenantInput } from '../schemas/tenant.schema';
import { UserRole } from '@prisma/client';
import { logger } from '../config/logger';
import { authService } from './auth.service';

export class TenantService {
  async create(input: CreateTenantInput) {
    return db.tenant.create({
      data: {
        name: input.name,
      },
    });
  }

  async createTenantWithAdmin(input: CreateTenantInput) {
    try {
      // Create tenant
      const tenant = await db.tenant.create({
        data: {
          name: input.name,
        },
      });

      let adminUser = null;

      // If admin email provided, create admin user
      if (input.adminEmail) {
        try {
          await authService.createInvitation(
            {
              userId: 'system',
              tenantId: tenant.id,
              email: 'system@leanstock.local',
              role: UserRole.SUPER_ADMIN,
              type: 'access',
            },
            input.adminEmail,
            UserRole.TENANT_ADMIN,
          );
          adminUser = { email: input.adminEmail };

          logger.info(
            `Created tenant ${tenant.id} with admin user ${input.adminEmail}`
          );
        } catch (error: any) {
          // If admin creation fails, delete the tenant and re-throw
          await db.tenant.delete({ where: { id: tenant.id } });
          logger.error(
            { err: error },
            `Failed to create admin user for tenant ${tenant.id}`
          );
          throw error;
        }
      }

      return {
        tenant,
        admin: adminUser ? {
          email: adminUser.email,
          inviteLink: null,
        } : null,
      };
    } catch (error) {
      logger.error({ err: error }, 'Create tenant with admin error');
      throw error;
    }
  }
}

export const tenantService = new TenantService();
