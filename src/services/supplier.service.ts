import { dbClient } from '../config/database';
import { logger } from '../config/logger';

export class SupplierService {
  async createSupplier(
    data: {
      name: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      contactPerson?: string;
      paymentTerms?: string;
    },
    tenantId: string
  ) {
    const supplier = await dbClient.supplier.create({
      data: {
        ...data,
        tenantId,
        status: 'ACTIVE',
      },
    });

    logger.info({
      msg: 'Supplier created',
      supplierId: supplier.id,
      tenantId,
    });

    return supplier;
  }

  async getSupplier(supplierId: string, tenantId: string) {
    const supplier = await dbClient.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId,
      },
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    return supplier;
  }

  async listSuppliers(tenantId: string) {
    return dbClient.supplier.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { products: true, purchaseOrders: true },
        },
      },
    });
  }

  async updateSupplier(
    supplierId: string,
    data: any,
    tenantId: string
  ) {
    const supplier = await dbClient.supplier.update({
      where: { id: supplierId },
      data,
    });

    return supplier;
  }

  async deleteSupplier(supplierId: string, tenantId: string) {
    await dbClient.supplier.delete({
      where: { id: supplierId },
    });

    logger.info({
      msg: 'Supplier deleted',
      supplierId,
      tenantId,
    });
  }
}

export const supplierService = new SupplierService();
export default supplierService;
