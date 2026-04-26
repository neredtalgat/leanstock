import { dbClient } from '../config/database';
import { logger } from '../config/logger';

export class InventoryService {
  async getInventory(productId: string, locationId: string, tenantId: string) {
    const inventory = await dbClient.inventory.findUnique({
      where: {
        productId_locationId: {
          productId,
          locationId,
        },
      },
    });

    if (!inventory) {
      throw new Error('Inventory not found');
    }

    return inventory;
  }

  async updateInventoryQuantity(
    productId: string,
    locationId: string,
    quantity: number,
    tenantId: string
  ) {
    const inventory = await dbClient.inventory.update({
      where: {
        productId_locationId: {
          productId,
          locationId,
        },
      },
      data: {
        quantity,
        availableQuantity: quantity,
        lastMovementDate: new Date(),
      },
    });

    return inventory;
  }

  async recordMovement(
    inventoryId: string,
    type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN',
    quantity: number,
    reason?: string,
    referenceId?: string,
    tenantId?: string
  ) {
    const inventory = await dbClient.inventory.findUnique({
      where: { id: inventoryId },
      include: { location: true },
    });

    if (!inventory) {
      throw new Error('Inventory not found');
    }

    let newQuantity = inventory.quantity;
    if (type === 'IN') {
      newQuantity += quantity;
    } else if (type === 'OUT') {
      newQuantity -= quantity;
    } else if (type === 'ADJUSTMENT') {
      newQuantity = quantity;
    }

    if (newQuantity < 0) {
      throw new Error('Insufficient inventory');
    }

    const movement = await dbClient.inventoryMovement.create({
      data: {
        type,
        quantity,
        reason,
        referenceId,
        referenceType: 'MANUAL',
        inventoryId,
        locationId: inventory.locationId,
      },
    });

    await dbClient.inventory.update({
      where: { id: inventoryId },
      data: {
        quantity: newQuantity,
        availableQuantity: newQuantity,
        lastMovementDate: new Date(),
      },
    });

    logger.info({
      msg: 'Inventory movement recorded',
      type,
      quantity,
      productId: inventory.id,
      locationId: inventory.locationId,
    });

    return movement;
  }

  async checkLowStock(tenantId: string) {
    const lowStockItems = await dbClient.inventory.findMany({
      where: {
        product: { tenantId },
        quantity: {
          lte: dbClient.product.fields.reorderPoint,
        },
      },
      include: {
        product: true,
        location: true,
      },
    });

    return lowStockItems;
  }
}

export const inventoryService = new InventoryService();
export default inventoryService;
