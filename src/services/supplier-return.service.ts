import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

export interface CreateSupplierReturnInput {
  supplierId: string;
  locationId: string;
  reason: string;
  notes?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    reason?: string;
  }[];
}

export interface UpdateSupplierReturnInput {
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'SHIPPED' | 'RECEIVED_BY_SUPPLIER' | 'CANCELLED';
  notes?: string;
}

export interface ShipReturnInput {
  carrier?: string;
  trackingNumber?: string;
}

export interface SupplierReturn {
  id: string;
  supplierId: string;
  locationId: string;
  status: string;
  reason: string;
  notes?: string;
  totalValue: number;
  totalItems: number;
  shippedItems: number;
  carrier?: string;
  trackingNumber?: string;
  shippedAt?: Date;
  receivedBySupplierAt?: Date;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: number;
    shippedQuantity: number;
    reason?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

class SupplierReturnService {
  async list(tenantId: string, status?: string): Promise<SupplierReturn[]> {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const returns = await (tenantDb as any).supplierReturn.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
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
      },
      orderBy: { createdAt: 'desc' },
    });

    return returns.map((ret: any) => this.formatReturn(ret));
  }

  async getById(tenantId: string, returnId: string): Promise<SupplierReturn | null> {
    const ret = await (tenantDb as any).supplierReturn.findFirst({
      where: { id: returnId, tenantId },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
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
      },
    });

    if (!ret) return null;
    return this.formatReturn(ret);
  }

  async create(
    tenantId: string,
    userId: string,
    input: CreateSupplierReturnInput
  ): Promise<SupplierReturn> {
    // Validate supplier exists
    const supplier = await (tenantDb as any).supplier.findFirst({
      where: { id: input.supplierId, tenantId },
    });

    if (!supplier) {
      throw new Error('SUPPLIER_NOT_FOUND');
    }

    // Validate location exists
    const location = await (tenantDb as any).location.findFirst({
      where: { id: input.locationId, tenantId },
    });

    if (!location) {
      throw new Error('LOCATION_NOT_FOUND');
    }

    // Calculate total value and validate inventory
    let totalValue = 0;
    const returnItems = [];

    for (const item of input.items) {
      // Check if product exists in inventory
      const inventory = await (tenantDb as any).inventory.findFirst({
        where: {
          tenantId,
          productId: item.productId,
          locationId: input.locationId,
        },
      });

      if (!inventory) {
        throw new Error(`PRODUCT_NOT_IN_LOCATION:${item.productId}`);
      }

      if (inventory.quantity < item.quantity) {
        throw new Error(`INSUFFICIENT_STOCK:${item.productId}`);
      }

      totalValue += item.unitPrice * item.quantity;

      returnItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        reason: item.reason,
        shippedQuantity: 0,
      });
    }

    const ret = await (tenantDb as any).supplierReturn.create({
      data: {
        tenantId,
        supplierId: input.supplierId,
        locationId: input.locationId,
        reason: input.reason,
        notes: input.notes,
        status: 'DRAFT',
        totalValue,
        totalItems: returnItems.reduce((sum, item) => sum + item.quantity, 0),
        items: {
          create: returnItems,
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
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
      },
    });

    // Create audit log
    await (tenantDb as any).auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'SUPPLIER_RETURN_CREATE',
        resource: 'SupplierReturn',
        resourceId: ret.id,
        changes: JSON.stringify({ supplierId: input.supplierId, items: input.items }),
      },
    });

    logger.info(`Supplier return created: ${ret.id} for tenant ${tenantId}`);

    return this.formatReturn(ret);
  }

  async update(
    tenantId: string,
    returnId: string,
    userId: string,
    input: UpdateSupplierReturnInput
  ): Promise<SupplierReturn> {
    const existingReturn = await (tenantDb as any).supplierReturn.findFirst({
      where: { id: returnId, tenantId },
    });

    if (!existingReturn) {
      throw new Error('RETURN_NOT_FOUND');
    }

    // Only allow updates in DRAFT status
    if (existingReturn.status !== 'DRAFT' && input.status === undefined) {
      throw new Error('CANNOT_UPDATE_SUBMITTED_RETURN');
    }

    const updateData: any = {};
    if (input.status) {
      updateData.status = input.status;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    const ret = await (tenantDb as any).supplierReturn.update({
      where: { id: returnId },
      data: updateData,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
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
      },
    });

    // Create audit log
    await (tenantDb as any).auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'SUPPLIER_RETURN_UPDATE',
        resource: 'SupplierReturn',
        resourceId: returnId,
        changes: JSON.stringify({ status: input.status }),
      },
    });

    logger.info(`Supplier return updated: ${returnId}, status: ${input.status}`);

    return this.formatReturn(ret);
  }

  async ship(
    tenantId: string,
    returnId: string,
    userId: string,
    input: ShipReturnInput
  ): Promise<SupplierReturn> {
    const existingReturn = await (tenantDb as any).supplierReturn.findFirst({
      where: { id: returnId, tenantId },
      include: { items: true },
    });

    if (!existingReturn) {
      throw new Error('RETURN_NOT_FOUND');
    }

    if (existingReturn.status !== 'APPROVED') {
      throw new Error('RETURN_NOT_APPROVED');
    }

    return await (tenantDb as any).$transaction(async (tx: any) => {
      // Decrement inventory quantities
      for (const item of existingReturn.items) {
        await tx.inventory.updateMany({
          where: {
            tenantId,
            productId: item.productId,
            locationId: existingReturn.locationId,
          },
          data: {
            quantity: { decrement: item.quantity },
          },
        });

        // Update item shipped quantity
        await tx.supplierReturnItem.update({
          where: { id: item.id },
          data: { shippedQuantity: item.quantity },
        });
      }

      const ret = await tx.supplierReturn.update({
        where: { id: returnId },
        data: {
          status: 'SHIPPED',
          carrier: input.carrier,
          trackingNumber: input.trackingNumber,
          shippedAt: new Date(),
          shippedItems: existingReturn.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
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
        },
      });

      // Create inventory movements
      for (const item of existingReturn.items) {
        const inventory = await tx.inventory.findFirst({
          where: {
            tenantId,
            productId: item.productId,
            locationId: existingReturn.locationId,
          },
        });

        if (inventory) {
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              inventoryId: inventory.id,
              type: 'RETURN',
              quantity: -item.quantity,
              referenceId: returnId,
              notes: `Return to supplier ${ret.supplier.name}`,
            },
          });
        }
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'SUPPLIER_RETURN_SHIP',
          resource: 'SupplierReturn',
          resourceId: returnId,
          changes: JSON.stringify({ carrier: input.carrier, trackingNumber: input.trackingNumber }),
        },
      });

      logger.info(`Supplier return shipped: ${returnId}`);

      return this.formatReturn(ret);
    });
  }

  async markReceivedBySupplier(
    tenantId: string,
    returnId: string,
    userId: string
  ): Promise<SupplierReturn> {
    const existingReturn = await (tenantDb as any).supplierReturn.findFirst({
      where: { id: returnId, tenantId },
    });

    if (!existingReturn) {
      throw new Error('RETURN_NOT_FOUND');
    }

    if (existingReturn.status !== 'SHIPPED') {
      throw new Error('RETURN_NOT_SHIPPED');
    }

    const ret = await (tenantDb as any).supplierReturn.update({
      where: { id: returnId },
      data: {
        status: 'RECEIVED_BY_SUPPLIER',
        receivedBySupplierAt: new Date(),
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
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
      },
    });

    // Create audit log
    await (tenantDb as any).auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'SUPPLIER_RETURN_RECEIVED',
        resource: 'SupplierReturn',
        resourceId: returnId,
        changes: JSON.stringify({ status: 'RECEIVED_BY_SUPPLIER' }),
      },
    });

    logger.info(`Supplier return marked as received by supplier: ${returnId}`);

    return this.formatReturn(ret);
  }

  async cancel(
    tenantId: string,
    returnId: string,
    userId: string,
    reason?: string
  ): Promise<SupplierReturn> {
    const existingReturn = await (tenantDb as any).supplierReturn.findFirst({
      where: { id: returnId, tenantId },
    });

    if (!existingReturn) {
      throw new Error('RETURN_NOT_FOUND');
    }

    // Cannot cancel if already shipped
    if (['SHIPPED', 'RECEIVED_BY_SUPPLIER'].includes(existingReturn.status)) {
      throw new Error('CANNOT_CANCEL_SHIPPED_RETURN');
    }

    const ret = await (tenantDb as any).supplierReturn.update({
      where: { id: returnId },
      data: {
        status: 'CANCELLED',
        notes: reason ? `${existingReturn.notes || ''}\nCancellation reason: ${reason}`.trim() : existingReturn.notes,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
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
      },
    });

    // Create audit log
    await (tenantDb as any).auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'SUPPLIER_RETURN_CANCEL',
        resource: 'SupplierReturn',
        resourceId: returnId,
        changes: JSON.stringify({ reason }),
      },
    });

    logger.info(`Supplier return cancelled: ${returnId}`);

    return this.formatReturn(ret);
  }

  private formatReturn(ret: any): SupplierReturn {
    return {
      id: ret.id,
      supplierId: ret.supplierId,
      locationId: ret.locationId,
      status: ret.status,
      reason: ret.reason,
      notes: ret.notes,
      totalValue: ret.totalValue,
      totalItems: ret.totalItems,
      shippedItems: ret.shippedItems || 0,
      carrier: ret.carrier,
      trackingNumber: ret.trackingNumber,
      shippedAt: ret.shippedAt,
      receivedBySupplierAt: ret.receivedBySupplierAt,
      items: ret.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || 'Unknown',
        productSku: item.product?.sku || 'Unknown',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        shippedQuantity: item.shippedQuantity || 0,
        reason: item.reason,
      })),
      createdAt: ret.createdAt,
      updatedAt: ret.updatedAt,
    };
  }
}

export const supplierReturnService = new SupplierReturnService();
