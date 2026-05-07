import { db } from '../config/database';
import { CreateTenantInput } from '../schemas/tenant.schema';

export class TenantService {
  async create(input: CreateTenantInput) {
    return db.tenant.create({
      data: {
        name: input.name,
      },
    });
  }
}

export const tenantService = new TenantService();
