#!/usr/bin/env ts-node

import { prisma } from '../src/config/database';
import { logger } from '../src/config/logger';

async function resetDatabase() {
  try {
    logger.info('Deleting all tables...');
    
    // Delete all data in order of dependencies
    await prisma.auditLog.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.priceHistory.deleteMany({});
    await prisma.demandHistory.deleteMany({});
    await prisma.deadStockRule.deleteMany({});
    await prisma.reorderPoint.deleteMany({});
    await prisma.inventoryMovement.deleteMany({});
    await prisma.transferItem.deleteMany({});
    await prisma.transferOrder.deleteMany({});
    await prisma.purchaseOrderItem.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.supplierProduct.deleteMany({});
    await prisma.supplier.deleteMany({});
    await prisma.inventory.deleteMany({});
    await prisma.binLocation.deleteMany({});
    await prisma.productVariant.deleteMany({});
    await prisma.productImage.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.location.deleteMany({});
    await prisma.apiKey.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.tenant.deleteMany({});

    logger.info('✅ All tables cleared');
  } catch (error) {
    logger.error({ msg: 'Failed to reset database', error });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
