import { transferService } from '../../src/services/transfer.service';
import { TransferStatus } from '@prisma/client';

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  tenantDb: {
    $transaction: jest.fn(),
    location: {
      findMany: jest.fn(),
    },
    inventory: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    transferOrder: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    transferItem: {
      update: jest.fn(),
    },
  },
  asyncLocalStorage: {
    run: jest.fn((store, callback) => callback()),
  },
}));

jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../src/config/env', () => ({
  env: {
    TRANSFER_APPROVAL_THRESHOLD: 1000,
  },
}));

jest.mock('../../src/services/notification.service', () => ({
  notificationService: {
    notifyTransferApprovalRequired: jest.fn(),
  },
}));

const { tenantDb } = jest.requireMock('../../src/config/database');
const { env } = jest.requireMock('../../src/config/env');

describe('TransferService', () => {
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockFromLocationId = 'loc-from-123';
  const mockToLocationId = 'loc-to-123';
  const mockProductId = 'prod-123';

  beforeEach(() => {
    jest.clearAllMocks();
    tenantDb.$transaction.mockImplementation((callback) =>
      callback(tenantDb)
    );
  });

  describe('create', () => {
    it('should create transfer with low value (no approval needed)', async () => {
      const createData = {
        fromLocationId: mockFromLocationId,
        toLocationId: mockToLocationId,
        items: [
          {
            productId: mockProductId,
            quantity: 5,
          },
        ],
        notes: 'Test transfer',
      };

      const mockLocations = [
        {
          id: mockFromLocationId,
          name: 'Warehouse A',
        },
        {
          id: mockToLocationId,
          name: 'Store B',
        },
      ];

      const mockInventory = {
        quantity: 100,
        reservedQuantity: 10,
        productId: mockProductId,
        locationId: mockFromLocationId,
      };

      const mockProduct = {
        id: mockProductId,
        retailPrice: 50,
      };

      const mockCreator = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      const mockTransferOrder = {
        id: 'transfer-123',
        tenantId: mockTenantId,
        fromLocationId: mockFromLocationId,
        toLocationId: mockToLocationId,
        status: 'APPROVED',
        totalValue: 250,
        requiresApproval: false,
        items: createData.items,
      };

      tenantDb.location.findMany.mockResolvedValue(mockLocations);
      tenantDb.inventory.findFirst.mockResolvedValue(mockInventory);
      tenantDb.product.findFirst.mockResolvedValue(mockProduct);
      tenantDb.user.findFirst.mockResolvedValue(mockCreator);
      tenantDb.transferOrder.create.mockResolvedValue(mockTransferOrder);

      const result = await transferService.create(
        createData,
        mockUserId,
        mockTenantId
      );

      expect(result.status).toBe('APPROVED');
      expect(result.requiresApproval).toBe(false);
      expect(result.totalValue).toBe(250);
      expect(tenantDb.transferOrder.create).toHaveBeenCalled();
    });

    it('should create transfer with high value (approval required)', async () => {
      const createData = {
        fromLocationId: mockFromLocationId,
        toLocationId: mockToLocationId,
        items: [
          {
            productId: mockProductId,
            quantity: 30,
          },
        ],
        notes: 'Expensive transfer',
      };

      const mockLocations = [
        { id: mockFromLocationId, name: 'Warehouse A' },
        { id: mockToLocationId, name: 'Store B' },
      ];

      const mockInventory = {
        quantity: 100,
        reservedQuantity: 10,
      };

      const mockProduct = {
        retailPrice: 50, // 30 * 50 = 1500 > 1000 threshold
      };

      const mockCreator = {
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const mockTransferOrder = {
        id: 'transfer-456',
        status: 'PENDING_APPROVAL',
        totalValue: 1500,
        requiresApproval: true,
        items: createData.items,
      };

      tenantDb.location.findMany.mockResolvedValue(mockLocations);
      tenantDb.inventory.findFirst.mockResolvedValue(mockInventory);
      tenantDb.product.findFirst.mockResolvedValue(mockProduct);
      tenantDb.user.findFirst.mockResolvedValue(mockCreator);
      tenantDb.transferOrder.create.mockResolvedValue(mockTransferOrder);

      const result = await transferService.create(
        createData,
        mockUserId,
        mockTenantId
      );

      expect(result.status).toBe('PENDING_APPROVAL');
      expect(result.requiresApproval).toBe(true);
      expect(result.totalValue).toBe(1500);
    });

    it('should reject transfer with same source and destination', async () => {
      const createData = {
        fromLocationId: mockFromLocationId,
        toLocationId: mockFromLocationId,
        items: [{ productId: mockProductId, quantity: 5 }],
      };

      tenantDb.$transaction.mockImplementationOnce((callback) => {
        try {
          return callback(tenantDb);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'SAME_LOCATION'
          ) {
            throw error;
          }
        }
      });

      await expect(
        transferService.create(createData, mockUserId, mockTenantId)
      ).rejects.toThrow('SAME_LOCATION');
    });

    it('should reject transfer with insufficient stock', async () => {
      const createData = {
        fromLocationId: mockFromLocationId,
        toLocationId: mockToLocationId,
        items: [
          {
            productId: mockProductId,
            quantity: 50,
          },
        ],
      };

      const mockLocations = [
        { id: mockFromLocationId },
        { id: mockToLocationId },
      ];

      const mockInventory = {
        quantity: 30, // Only 30 available, need 50
        reservedQuantity: 10, // Available = 30 - 10 = 20
      };

      tenantDb.location.findMany.mockResolvedValue(mockLocations);
      tenantDb.inventory.findFirst.mockResolvedValue(mockInventory);

      await expect(
        transferService.create(createData, mockUserId, mockTenantId)
      ).rejects.toThrow(expect.stringMatching(/INSUFFICIENT_STOCK/));
    });

    it('should reject transfer with invalid location', async () => {
      const createData = {
        fromLocationId: mockFromLocationId,
        toLocationId: mockToLocationId,
        items: [{ productId: mockProductId, quantity: 5 }],
      };

      // Only return one location, should fail validation
      tenantDb.location.findMany.mockResolvedValue([
        { id: mockFromLocationId },
      ]);

      await expect(
        transferService.create(createData, mockUserId, mockTenantId)
      ).rejects.toThrow('INVALID_LOCATION');
    });
  });

  describe('ship', () => {
    it('should update transfer status to IN_TRANSIT', async () => {
      const transferId = 'transfer-123';
      const shipData = {
        carrier: 'DHL',
        trackingNumber: 'TRACK123',
      };

      const mockTransfer = {
        id: transferId,
        status: 'APPROVED',
        items: [
          {
            id: 'item-1',
            quantity: 10,
            quantityShipped: 0,
          },
        ],
      };

      const mockUpdatedTransfer = {
        ...mockTransfer,
        status: 'IN_TRANSIT',
        shippedAt: new Date(),
      };

      tenantDb.transferOrder.findFirst.mockResolvedValue(mockTransfer);
      tenantDb.transferOrder.update.mockResolvedValue(mockUpdatedTransfer);

      const result = await transferService.ship(
        transferId,
        shipData,
        mockTenantId
      );

      expect(result.status).toBe('IN_TRANSIT');
    });
  });

  describe('receive', () => {
    it('should update inventory on partial receive', async () => {
      const transferId = 'transfer-123';
      const receiveData = [
        {
          transferItemId: 'item-1',
          quantity: 7, // Receiving 7 out of 10
          productId: mockProductId,
          locationId: mockToLocationId,
        },
      ];

      const mockTransfer = {
        id: transferId,
        status: 'IN_TRANSIT',
        items: [
          {
            id: 'item-1',
            quantity: 10,
            receivedQuantity: 0,
          },
        ],
      };

      tenantDb.transferOrder.findFirst.mockResolvedValue(mockTransfer);
      tenantDb.transferOrder.update.mockResolvedValue({
        ...mockTransfer,
        status: 'PARTIALLY_RECEIVED',
      });

      const result = await transferService.receive(
        transferId,
        receiveData,
        mockTenantId
      );

      expect(result.status).toBe('PARTIALLY_RECEIVED');
    });

    it('should mark transfer COMPLETED when fully received', async () => {
      const transferId = 'transfer-123';
      const receiveData = [
        {
          transferItemId: 'item-1',
          quantity: 10,
          productId: mockProductId,
          locationId: mockToLocationId,
        },
      ];

      const mockTransfer = {
        id: transferId,
        status: 'IN_TRANSIT',
        items: [
          {
            id: 'item-1',
            quantity: 10,
            receivedQuantity: 0,
          },
        ],
      };

      tenantDb.transferOrder.findFirst.mockResolvedValue(mockTransfer);
      tenantDb.transferOrder.update.mockResolvedValue({
        ...mockTransfer,
        status: 'COMPLETED',
      });

      const result = await transferService.receive(
        transferId,
        receiveData,
        mockTenantId
      );

      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('approve', () => {
    it('should approve pending transfer', async () => {
      const transferId = 'transfer-123';
      const approveData = {
        approved: true,
      };

      const mockTransfer = {
        id: transferId,
        status: 'PENDING_APPROVAL',
      };

      tenantDb.transferOrder.findFirst.mockResolvedValue(mockTransfer);
      tenantDb.transferOrder.update.mockResolvedValue({
        ...mockTransfer,
        status: 'APPROVED',
      });

      const result = await transferService.approve(
        transferId,
        approveData,
        mockUserId,
        mockTenantId
      );

      expect(result.status).toBe('APPROVED');
    });

    it('should reject pending transfer with reason', async () => {
      const transferId = 'transfer-123';
      const rejectData = {
        approved: false,
        rejectionReason: 'Insufficient budget',
      };

      const mockTransfer = {
        id: transferId,
        status: 'PENDING_APPROVAL',
      };

      tenantDb.transferOrder.findFirst.mockResolvedValue(mockTransfer);
      tenantDb.transferOrder.update.mockResolvedValue({
        ...mockTransfer,
        status: 'CANCELLED',
      });

      const result = await transferService.approve(
        transferId,
        rejectData,
        mockUserId,
        mockTenantId
      );

      expect(result.status).toBe('CANCELLED');
    });
  });
});
