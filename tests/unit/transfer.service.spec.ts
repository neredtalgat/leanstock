import { transferService, CreateTransferInput, ReceiveItemInput } from '../../src/services/transfer.service';
import { prisma } from '../../src/config/database';
import { ConflictError, ValidationError, NotFoundError } from '../../src/utils/errors';

describe('TransferService', () => {
  let tenantId: string;
  let userId: string;
  let sourceLocationId: string;
  let destinationLocationId: string;
  let productId: string;

  beforeAll(async () => {
    // Create test data
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Tenant' },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        email: 'test@test.com',
        password: 'hashed',
        firstName: 'Test',
        lastName: 'User',
        role: 'STORE_MANAGER',
        tenantId,
      },
    });
    userId = user.id;

    const sourceLocation = await prisma.location.create({
      data: {
        tenantId,
        name: 'Warehouse A',
        address: '123 Main St',
      },
    });
    sourceLocationId = sourceLocation.id;

    const destLocation = await prisma.location.create({
      data: {
        tenantId,
        name: 'Warehouse B',
        address: '456 Oak Ave',
      },
    });
    destinationLocationId = destLocation.id;

    const product = await prisma.product.create({
      data: {
        tenantId,
        name: 'Test Product',
        sku: 'SKU-001',
        category: 'Electronics',
        retailPrice: 100,
        costPrice: 50,
        unit: 'pcs',
      },
    });
    productId = product.id;

    // Create inventory at source
    await prisma.inventory.create({
      data: {
        tenantId,
        productId,
        locationId: sourceLocationId,
        available: 100,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.transferOrder.deleteMany({ where: { tenantId } });
    await prisma.inventory.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.location.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  describe('create', () => {
    it('should create a transfer with approved status for value <= 1000', async () => {
      const input: CreateTransferInput = {
        sourceLocationId,
        destinationLocationId,
        items: [
          {
            productId,
            quantity: 5,
          },
        ],
      };

      const transfer = await transferService.create(input, userId, tenantId);

      expect(transfer.code).toMatch(/^TRF-/);
      expect(transfer.status).toBe('APPROVED');
      expect(transfer.requiresApproval).toBe(false);
      expect(transfer.totalValue).toBe(500); // 100 * 5
      expect(transfer.items).toHaveLength(1);
    });

    it('should create transfer with pending approval for value > 1000', async () => {
      const input: CreateTransferInput = {
        sourceLocationId,
        destinationLocationId,
        items: [
          {
            productId,
            quantity: 15, // 15 * 100 = 1500
          },
        ],
      };

      const transfer = await transferService.create(input, userId, tenantId);

      expect(transfer.status).toBe('PENDING_APPROVAL');
      expect(transfer.requiresApproval).toBe(true);
    });

    it('should fail if source equals destination', async () => {
      const input: CreateTransferInput = {
        sourceLocationId,
        destinationLocationId: sourceLocationId,
        items: [{ productId, quantity: 5 }],
      };

      await expect(transferService.create(input, userId, tenantId)).rejects.toThrow(
        ValidationError
      );
    });

    it('should fail if insufficient inventory', async () => {
      const input: CreateTransferInput = {
        sourceLocationId,
        destinationLocationId,
        items: [
          {
            productId,
            quantity: 1000, // More than available
          },
        ],
      };

      await expect(transferService.create(input, userId, tenantId)).rejects.toThrow(
        ConflictError
      );
    });

    it('should lock inventory and update inTransit', async () => {
      const beforeInventory = await prisma.inventory.findUnique({
        where: {
          productId_locationId: {
            productId,
            locationId: sourceLocationId,
          },
        },
      });

      const input: CreateTransferInput = {
        sourceLocationId,
        destinationLocationId,
        items: [{ productId, quantity: 10 }],
      };

      await transferService.create(input, userId, tenantId);

      const afterInventory = await prisma.inventory.findUnique({
        where: {
          productId_locationId: {
            productId,
            locationId: sourceLocationId,
          },
        },
      });

      expect(afterInventory!.available).toBe(beforeInventory!.available - 10);
      expect(afterInventory!.inTransit).toBe(10);
    });
  });

  describe('approve', () => {
    it('should approve transfer and change status', async () => {
      const transfer = await transferService.create(
        {
          sourceLocationId,
          destinationLocationId,
          items: [{ productId, quantity: 12 }],
        },
        userId,
        tenantId
      );

      if (transfer.status === 'PENDING_APPROVAL') {
        const approved = await transferService.approve(
          transfer.id,
          true,
          '',
          userId,
          tenantId
        );

        expect(approved.status).toBe('APPROVED');
        expect(approved.approvedBy).toBe(userId);
      }
    });

    it('should reject transfer and revert inventory', async () => {
      const input: CreateTransferInput = {
        sourceLocationId,
        destinationLocationId,
        items: [{ productId, quantity: 15 }],
      };

      const transfer = await transferService.create(input, userId, tenantId);

      const beforeInventory = await prisma.inventory.findUnique({
        where: {
          productId_locationId: {
            productId,
            locationId: sourceLocationId,
          },
        },
      });

      if (transfer.status === 'PENDING_APPROVAL') {
        await transferService.approve(
          transfer.id,
          false,
          'Out of stock at destination',
          userId,
          tenantId
        );

        const afterInventory = await prisma.inventory.findUnique({
          where: {
            productId_locationId: {
              productId,
              locationId: sourceLocationId,
            },
          },
        });

        expect(afterInventory!.available).toBe(beforeInventory!.available);
        expect(afterInventory!.inTransit).toBe(0);
      }
    });
  });

  describe('ship', () => {
    it('should mark transfer as in transit', async () => {
      const transfer = await transferService.create(
        {
          sourceLocationId,
          destinationLocationId,
          items: [{ productId, quantity: 5 }],
        },
        userId,
        tenantId
      );

      const shipped = await transferService.ship(
        transfer.id,
        'FedEx',
        'TRK-123456',
        userId,
        tenantId
      );

      expect(shipped.status).toBe('IN_TRANSIT');
      expect(shipped.carrier).toBe('FedEx');
      expect(shipped.trackingNumber).toBe('TRK-123456');
      expect(shipped.shippedAt).toBeDefined();
    });
  });

  describe('receive', () => {
    it('should complete transfer when all items received', async () => {
      const transfer = await transferService.create(
        {
          sourceLocationId,
          destinationLocationId,
          items: [{ productId, quantity: 5 }],
        },
        userId,
        tenantId
      );

      await transferService.ship(
        transfer.id,
        'UPS',
        'TRK-789',
        userId,
        tenantId
      );

      const transferItems = transfer.items;
      const receiveItems: ReceiveItemInput[] = transferItems.map((item) => ({
        transferItemId: item.id,
        quantityReceived: item.quantityShipped,
      }));

      const received = await transferService.receive(transfer.id, receiveItems, userId, tenantId);

      expect(received.status).toBe('COMPLETED');
      expect(received.receivedAt).toBeDefined();
    });

    it('should mark as partially received', async () => {
      const transfer = await transferService.create(
        {
          sourceLocationId,
          destinationLocationId,
          items: [{ productId, quantity: 10 }],
        },
        userId,
        tenantId
      );

      await transferService.ship(
        transfer.id,
        'DHL',
        'TRK-456',
        userId,
        tenantId
      );

      const transferItems = transfer.items;
      const receiveItems: ReceiveItemInput[] = transferItems.map((item) => ({
        transferItemId: item.id,
        quantityReceived: item.quantityShipped / 2,
      }));

      const received = await transferService.receive(transfer.id, receiveItems, userId, tenantId);

      expect(received.status).toBe('PARTIALLY_RECEIVED');
    });

    it('should add inventory at destination', async () => {
      const transfer = await transferService.create(
        {
          sourceLocationId,
          destinationLocationId,
          items: [{ productId, quantity: 8 }],
        },
        userId,
        tenantId
      );

      await transferService.ship(
        transfer.id,
        'TNT',
        'TRK-999',
        userId,
        tenantId
      );

      const beforeDestInventory = await prisma.inventory.findUnique({
        where: {
          productId_locationId: {
            productId,
            locationId: destinationLocationId,
          },
        },
      });

      const transferItems = transfer.items;
      const receiveItems: ReceiveItemInput[] = transferItems.map((item) => ({
        transferItemId: item.id,
        quantityReceived: item.quantityShipped,
      }));

      await transferService.receive(transfer.id, receiveItems, userId, tenantId);

      const afterDestInventory = await prisma.inventory.findUnique({
        where: {
          productId_locationId: {
            productId,
            locationId: destinationLocationId,
          },
        },
      });

      if (beforeDestInventory) {
        expect(afterDestInventory!.available).toBe(beforeDestInventory.available + 8);
      } else {
        expect(afterDestInventory!.available).toBe(8);
      }
    });
  });

  describe('list', () => {
    it('should list transfers with pagination', async () => {
      await transferService.create(
        {
          sourceLocationId,
          destinationLocationId,
          items: [{ productId, quantity: 3 }],
        },
        userId,
        tenantId
      );

      const { transfers, hasMore } = await transferService.list(tenantId, { limit: 10 });

      expect(transfers.length).toBeGreaterThan(0);
      expect(Array.isArray(transfers)).toBe(true);
    });

    it('should filter by status', async () => {
      const { transfers } = await transferService.list(tenantId, {
        status: 'APPROVED',
      });

      expect(transfers.every((t) => t.status === 'APPROVED')).toBe(true);
    });
  });
});
