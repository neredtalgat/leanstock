import { db } from '../config/database';
import { CreateTenantInput } from '../schemas/tenant.schema';
import { UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger';

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
      let inviteToken = null;

      // If admin email provided, create admin user
      if (input.adminEmail) {
        try {
          // Create TENANT_ADMIN user
          adminUser = await db.user.create({
            data: {
              email: input.adminEmail,
              firstName: input.adminFirstName || '',
              lastName: input.adminLastName || '',
              role: UserRole.TENANT_ADMIN,
              tenantId: tenant.id,
              isActive: true,
              emailVerified: true,
              passwordHash: '', // Placeholder - will be set when user accepts invite
            },
          });

          // Create invite token directly (replicating invitation flow)
          inviteToken = jwt.sign(
            {
              email: input.adminEmail,
              role: UserRole.TENANT_ADMIN,
              tenantId: tenant.id,
              invitedBy: 'system',
              type: 'invite',
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
          );

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
          inviteToken,
          inviteLink: inviteToken ? `${process.env.APP_URL || 'http://localhost:3000'}/auth/register-invite?token=${inviteToken}` : null,
        } : null,
      };
    } catch (error) {
      logger.error({ err: error }, 'Create tenant with admin error');
      throw error;
    }
  }
}

export const tenantService = new TenantService();
