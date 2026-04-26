import { dbClient } from '../config/database';
import { logger } from '../config/logger';
import { generateCode } from '../utils/helpers';

export class PurchaseOrderService {
  async createPurchaseOrder(
    data: {
      supplierId: string;
      items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
      }>;
      expectedDate?: Date;
      notes?: string;
    },
    tenantId: string
  ) {
    const code = generateCode('PO');
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const purchaseOrder = await dbClient.purchaseOrder.create({
      data: {
        code,
        supplierId: data.supplierId,
        tenantId,
        status: 'DRAFT',
        totalAmount,
        expectedDate: data.expectedDate,
        notes: data.notes,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    logger.info({
      msg: 'Purchase order created',
      poId: purchaseOrder.id,
      code,
      tenantId,
    });

    return purchaseOrder;
  }

  async getPurchaseOrder(poId: string, tenantId: string) {
    const po = await dbClient.purchaseOrder.findFirst({
      where: {
        id: poId,
        tenantId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
      },
    });

    if (!po) {
      throw new Error('Purchase order not found');
    }

    return po;
  }

  async confirmPurchaseOrder(poId: string, tenantId: string) {
    const po = await dbClient.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'CONFIRMED' },
      include: { items: true },
    });

    logger.info({
      msg: 'Purchase order confirmed',
      poId,
      tenantId,
    });

    return po;
  }

  async receivePurchaseOrder(
    poId: string,
    items: Array<{ itemId: string; receivedQuantity: number }>,
    tenantId: string
  ) {
    const po = await dbClient.purchaseOrder.findFirst({
      where: { id: poId, tenantId },
      include: { items: true },
    });

    if (!po) {
      throw new Error('Purchase order not found');
    }

    // Update received quantities
    for (const item of items) {
      await dbClient.purchaseOrderItem.update({
        where: { id: item.itemId },
        data: { receivedQuantity: item.receivedQuantity },
      });
    }

    // Check if fully received
    const updatedItems = await dbClient.purchaseOrderItem.findMany({
      where: { purchaseOrderId: poId },
    });

    const allReceived = updatedItems.every((item) => item.receivedQuantity === item.quantity);

    const updatedPO = await dbClient.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        receivedDate: new Date(),
      },
      include: { items: true },
    });

    logger.info({
      msg: 'Purchase order received',
      poId,
      status: updatedPO.status,
      tenantId,
    });

    return updatedPO;
  }
}

export const purchaseOrderService = new PurchaseOrderService();
export default purchaseOrderService;
