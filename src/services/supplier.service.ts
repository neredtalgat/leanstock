import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

export interface CreateSupplierInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface AddProductInput {
  productId: string;
  supplierSku: string;
  price: number;
  leadTimeDays?: number;
}

class SupplierService {
  async list(tenantId: string, options?: { search?: string }) {
    const where: any = { tenantId };

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const suppliers = await (tenantDb as any).supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            products: true,
            purchaseOrders: true,
          },
        },
      },
    });

    return suppliers.map((s: any) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      address: s.address,
      productsCount: s._count.products,
      purchaseOrdersCount: s._count.purchaseOrders,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  async getById(tenantId: string, id: string) {
    const supplier = await (tenantDb as any).supplier.findFirst({
      where: { id, tenantId },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });

    if (!supplier) {
      return null;
    }

    return {
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      products: supplier.products.map((sp: any) => ({
        id: sp.id,
        productId: sp.productId,
        productSku: sp.product.sku,
        productName: sp.product.name,
        supplierSku: sp.supplierSku,
        price: sp.price,
        leadTimeDays: sp.leadTimeDays,
        createdAt: sp.createdAt,
        updatedAt: sp.updatedAt,
      })),
      purchaseOrdersCount: supplier._count.purchaseOrders,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    };
  }

  async create(tenantId: string, input: CreateSupplierInput) {
    const supplier = await (tenantDb as any).supplier.create({
      data: {
        tenantId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
      },
    });

    logger.info(`Supplier created: ${supplier.id} for tenant ${tenantId}`);

    return {
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    };
  }

  async update(tenantId: string, id: string, input: UpdateSupplierInput) {
    const existing = await (tenantDb as any).supplier.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('SUPPLIER_NOT_FOUND');
    }

    const supplier = await (tenantDb as any).supplier.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
      },
    });

    logger.info(`Supplier updated: ${supplier.id} for tenant ${tenantId}`);

    return {
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    };
  }

  async delete(tenantId: string, id: string) {
    const existing = await (tenantDb as any).supplier.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
            products: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error('SUPPLIER_NOT_FOUND');
    }

    if (existing._count.purchaseOrders > 0) {
      throw new Error('SUPPLIER_HAS_PURCHASE_ORDERS');
    }

    await (tenantDb as any).supplierProduct.deleteMany({
      where: { supplierId: id },
    });

    await (tenantDb as any).supplier.delete({
      where: { id },
    });

    logger.info(`Supplier deleted: ${id} for tenant ${tenantId}`);
  }

  async addProduct(tenantId: string, supplierId: string, input: AddProductInput) {
    const supplier = await (tenantDb as any).supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      throw new Error('SUPPLIER_NOT_FOUND');
    }

    const product = await (tenantDb as any).product.findFirst({
      where: { id: input.productId, tenantId },
    });

    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    const supplierProduct = await (tenantDb as any).supplierProduct.upsert({
      where: {
        supplierId_productId: {
          supplierId,
          productId: input.productId,
        },
      },
      create: {
        supplierId,
        productId: input.productId,
        supplierSku: input.supplierSku,
        price: input.price,
        leadTimeDays: input.leadTimeDays,
      },
      update: {
        supplierSku: input.supplierSku,
        price: input.price,
        leadTimeDays: input.leadTimeDays,
      },
    });

    logger.info(`Supplier product added/updated: ${supplierProduct.id}`);

    return supplierProduct;
  }

  async removeProduct(tenantId: string, supplierId: string, productId: string) {
    const supplier = await (tenantDb as any).supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      throw new Error('SUPPLIER_NOT_FOUND');
    }

    await (tenantDb as any).supplierProduct.deleteMany({
      where: { supplierId, productId },
    });

    logger.info(`Supplier product removed: supplier ${supplierId}, product ${productId}`);
  }

  async getProducts(tenantId: string, supplierId: string) {
    const supplier = await (tenantDb as any).supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      throw new Error('SUPPLIER_NOT_FOUND');
    }

    const products = await (tenantDb as any).supplierProduct.findMany({
      where: { supplierId },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return products.map((sp: any) => ({
      id: sp.id,
      productId: sp.productId,
      productSku: sp.product.sku,
      productName: sp.product.name,
      supplierSku: sp.supplierSku,
      price: sp.price,
      leadTimeDays: sp.leadTimeDays,
      createdAt: sp.createdAt,
      updatedAt: sp.updatedAt,
    }));
  }
}

export const supplierService = new SupplierService();
