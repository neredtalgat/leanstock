import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

export interface CreatePurchaseOrderInput {
  supplierId: string;
  expectedDeliveryDate?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface UpdatePurchaseOrderInput {
  status?: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'RECEIVING' | 'COMPLETED' | 'CANCELLED';
  expectedDeliveryDate?: string;
}

export interface ReceiveItemsInput {
  items: {
    productId: string;
    quantityReceived: number;
  }[];
}

class PurchaseOrderService {
  async list(tenantId: string, status?: string) {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const orders = await (tenantDb as any).purchaseOrder.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
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

    return orders.map((order: any) => ({
      id: order.id,
      supplierId: order.supplierId,
      supplier: order.supplier,
      status: order.status,
      expectedDeliveryDate: order.expectedDeliveryDate,
      totalAmount: order.items.reduce((sum: number, item: any) => 
        sum + (item.quantity * item.unitPrice), 0),
      totalItems: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      receivedItems: order.items.reduce((sum: number, item: any) => sum + item.receivedQuantity, 0),
      items: order.items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));
  }

  async create(tenantId: string, userId: string, input: CreatePurchaseOrderInput) {
    const order = await (tenantDb as any).purchaseOrder.create({
      data: {
        tenantId,
        supplierId: input.supplierId,
        expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : null,
        status: 'DRAFT',
        items: {
          create: input.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            receivedQuantity: 0,
          })),
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
        action: 'PURCHASE_ORDER_CREATE',
        entityType: 'PurchaseOrder',
        entityId: order.id,
        newValues: { supplierId: input.supplierId, items: input.items },
      },
    });

    logger.info(`Purchase order created: ${order.id} for tenant ${tenantId}`);

    return {
      id: order.id,
      supplierId: order.supplierId,
      supplier: order.supplier,
      status: order.status,
      expectedDeliveryDate: order.expectedDeliveryDate,
      totalAmount: order.items.reduce((sum: number, item: any) => 
        sum + (item.quantity * item.unitPrice), 0),
      totalItems: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      items: order.items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async update(tenantId: string, orderId: string, userId: string, input: UpdatePurchaseOrderInput) {
    const existingOrder = await (tenantDb as any).purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!existingOrder) {
      throw new Error('ORDER_NOT_FOUND');
    }

    const updateData: any = {};
    if (input.status) {
      updateData.status = input.status;
    }
    if (input.expectedDeliveryDate) {
      updateData.expectedDeliveryDate = new Date(input.expectedDeliveryDate);
    }

    const order = await (tenantDb as any).purchaseOrder.update({
      where: { id: orderId },
      data: updateData,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
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
        action: 'PURCHASE_ORDER_UPDATE',
        entityType: 'PurchaseOrder',
        entityId: order.id,
        oldValues: { status: existingOrder.status },
        newValues: { status: input.status },
      },
    });

    logger.info(`Purchase order updated: ${order.id}, status: ${input.status}`);

    return {
      id: order.id,
      supplierId: order.supplierId,
      supplier: order.supplier,
      status: order.status,
      expectedDeliveryDate: order.expectedDeliveryDate,
      totalAmount: order.items.reduce((sum: number, item: any) => 
        sum + (item.quantity * item.unitPrice), 0),
      totalItems: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      receivedItems: order.items.reduce((sum: number, item: any) => sum + item.receivedQuantity, 0),
      items: order.items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async receive(tenantId: string, orderId: string, userId: string, input: ReceiveItemsInput) {
    const order = await (tenantDb as any).purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    // Update each item's received quantity
    for (const received of input.items) {
      const orderItem = order.items.find((item: any) => item.productId === received.productId);
      if (!orderItem) {
        throw new Error(`PRODUCT_NOT_IN_ORDER:${received.productId}`);
      }

      const newReceived = orderItem.receivedQuantity + received.quantityReceived;
      
      await (tenantDb as any).purchaseOrderItem.update({
        where: { id: orderItem.id },
        data: { receivedQuantity: newReceived },
      });

      // Update inventory
      const inventory = await (tenantDb as any).inventory.findFirst({
        where: {
          tenantId,
          productId: received.productId,
          locationId: order.items[0].locationId || null,
        },
      });

      if (inventory) {
        await (tenantDb as any).inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: { increment: received.quantityReceived },
            lastMovedAt: new Date(),
            daysInInventory: 0,
          },
        });
      }
    }

    // Check if all items are fully received
    const allItems = await (tenantDb as any).purchaseOrderItem.findMany({
      where: { purchaseOrderId: orderId },
    });

    const allReceived = allItems.every((item: any) => item.receivedQuantity >= item.quantity);
    const newStatus = allReceived ? 'COMPLETED' : 'RECEIVING';

    const updatedOrder = await (tenantDb as any).purchaseOrder.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
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
        action: 'PURCHASE_ORDER_RECEIVE',
        entityType: 'PurchaseOrder',
        entityId: orderId,
        newValues: { items: input.items, newStatus },
      },
    });

    logger.info(`Purchase order received: ${orderId}, status: ${newStatus}`);

    return {
      id: updatedOrder.id,
      supplierId: updatedOrder.supplierId,
      supplier: updatedOrder.supplier,
      status: updatedOrder.status,
      expectedDeliveryDate: updatedOrder.expectedDeliveryDate,
      totalAmount: updatedOrder.items.reduce((sum: number, item: any) => 
        sum + (item.quantity * item.unitPrice), 0),
      totalItems: updatedOrder.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      receivedItems: updatedOrder.items.reduce((sum: number, item: any) => sum + item.receivedQuantity, 0),
      items: updatedOrder.items,
      createdAt: updatedOrder.createdAt,
      updatedAt: updatedOrder.updatedAt,
    };
  }
}

export const purchaseOrderService = new PurchaseOrderService();
