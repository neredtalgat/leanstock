import { UserRole } from '@prisma/client';
import { injectTenant } from '../../src/middleware/tenant';
import { permissionsMatrix, requirePermission } from '../../src/middleware/rbac';

describe('Security - Tenant and RBAC', () => {
  describe('injectTenant', () => {
    it('prefers tenantId from JWT over X-Tenant-ID header', () => {
      const req: any = {
        user: {
          userId: 'u1',
          tenantId: '11111111-1111-1111-1111-111111111111',
          role: UserRole.TENANT_ADMIN,
        },
        headers: {
          'x-tenant-id': '22222222-2222-2222-2222-222222222222',
        },
      };

      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      injectTenant(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.tenantId).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('returns 400 when tenantId is missing', () => {
      const req: any = { user: undefined, headers: {} };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      injectTenant(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'MISSING_TENANT' }),
      );
    });
  });

  describe('requirePermission and matrix', () => {
    it('contains all route-level security permissions in SUPER_ADMIN matrix', () => {
      const required = [
        'notifications:read',
        'suppliers:create',
        'suppliers:update',
        'suppliers:delete',
        'purchase_orders:create',
        'purchase_orders:update',
        'purchase_orders:receive',
        'reorder-points:create',
        'reorder-points:update',
        'reorder-points:delete',
        'locations:create',
        'locations:update',
        'locations:delete',
        'inventory:create',
        'inventory:update',
        'inventory:delete',
        'inventory:adjust',
        'orders:create',
        'orders:update',
        'orders:delete',
        'orders:approve',
        'products:create',
        'products:update',
        'products:delete',
        'audit:read',
      ];

      const superAdminPerms = permissionsMatrix[UserRole.SUPER_ADMIN];
      for (const perm of required) {
        expect(superAdminPerms.has(perm)).toBe(true);
      }
    });

    it('denies permission not present in role matrix', () => {
      const middleware = requirePermission('products:create');

      const req: any = {
        user: {
          userId: 'u2',
          role: UserRole.STORE_ASSOCIATE,
        },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN' }),
      );
    });
  });
});
