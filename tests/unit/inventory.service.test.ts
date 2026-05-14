import { inventoryService } from '../../src/services/inventory.service';

jest.mock('../../src/config/database', () => ({
  tenantDb: {
    inventory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reorderPoint: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    location: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const { tenantDb } = jest.requireMock('../../src/config/database');

describe('InventoryService', () => {
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockProductId = 'prod-123';
  const mockLocationId = 'loc-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should list all inventory for tenant', async () => {
      const mockInventory = [
        {
          id: 'inv-1',
          tenantId: mockTenantId,
          productId: 'prod-1',
          locationId: mockLocationId,
          quantity: 100,
          reservedQuantity: 20,
          inTransit: 10,
          product: {
            id: 'prod-1',
            sku: 'SKU-001',
            name: 'Product 1',
            baseCost: 50,
          },
          location: {
            id: mockLocationId,
            name: 'Warehouse A',
            type: 'warehouse',
          },
        },
      ];

      const mockReorderPoints = [];

      tenantDb.inventory.findMany.mockResolvedValue(mockInventory);
      tenantDb.reorderPoint.findMany.mockResolvedValue(mockReorderPoints);

      const result = await inventoryService.list(mockTenantId, {});

      expect(result).toEqual(mockInventory);
      expect(tenantDb.inventory.findMany).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should filter inventory by product', async () => {
      const mockInventory = [
        {
          id: 'inv-1',
          productId: mockProductId,
          quantity: 100,
        },
      ];

      tenantDb.inventory.findMany.mockResolvedValue(mockInventory);
      tenantDb.reorderPoint.findMany.mockResolvedValue([]);

      await inventoryService.list(mockTenantId, {
        productId: mockProductId,
      });

      expect(tenantDb.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productId: mockProductId,
          }),
        })
      );
    });

    it('should filter inventory by location', async () => {
      const mockInventory = [
        {
          id: 'inv-1',
          locationId: mockLocationId,
          quantity: 100,
        },
      ];

      tenantDb.inventory.findMany.mockResolvedValue(mockInventory);
      tenantDb.reorderPoint.findMany.mockResolvedValue([]);

      await inventoryService.list(mockTenantId, {
        locationId: mockLocationId,
      });

      expect(tenantDb.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            locationId: mockLocationId,
          }),
        })
      );
    });

    it('should identify low stock items', async () => {
      const mockInventory = [
        {
          id: 'inv-1',
          productId: 'prod-1',
          locationId: mockLocationId,
          quantity: 5,
          reservedQuantity: 2,
        },
      ];

      const mockReorderPoints = [
        {
          productId: 'prod-1',
          locationId: mockLocationId,
          minQuantity: 10,
          maxQuantity: 50,
        },
      ];

      tenantDb.inventory.findMany.mockResolvedValue(mockInventory);
      tenantDb.reorderPoint.findMany.mockResolvedValue(mockReorderPoints);

      const result = await inventoryService.list(mockTenantId, {
        lowStock: true,
      });

      expect(result).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create inventory record', async () => {
      const createData = {
        productId: mockProductId,
        locationId: mockLocationId,
        quantity: 100,
        reservedQuantity: 0,
        inTransit: 0,
      };

      const mockCreatedInventory = {
        id: 'inv-123',
        tenantId: mockTenantId,
        ...createData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      tenantDb.inventory.create.mockResolvedValue(mockCreatedInventory);

      const result = await inventoryService.create(
        mockTenantId,
        createData
      );

      expect(result).toEqual(mockCreatedInventory);
      expect(tenantDb.inventory.create).toHaveBeenCalledWith({
        data: {
          tenantId: mockTenantId,
          ...createData,
        },
      });
    });
  });

  describe('adjust', () => {
    it('should adjust inventory quantity with reason', async () => {
      const adjustData = {
        productId: mockProductId,
        locationId: mockLocationId,
        newQuantity: 150,
        reason: 'Physical count adjustment',
      };

      const mockCurrentInventory = {
        id: 'inv-123',
        quantity: 100,
        reservedQuantity: 20,
        inTransit: 5,
      };

      const mockUpdatedInventory = {
        ...mockCurrentInventory,
        quantity: 150,
        updatedAt: new Date(),
      };

      const mockMovement = {
        id: 'mov-123',
        type: 'ADJUSTMENT',
        quantity: 50,
        notes: adjustData.reason,
      };

      tenantDb.inventory.findFirst.mockResolvedValue(mockCurrentInventory);
      tenantDb.$transaction.mockImplementation((callback) =>
        callback(tenantDb)
      );
      tenantDb.inventory.update.mockResolvedValue(mockUpdatedInventory);
      tenantDb.inventoryMovement.create.mockResolvedValue(mockMovement);

      const result = await inventoryService.adjust(
        mockTenantId,
        mockUserId,
        adjustData
      );

      expect(result).toEqual(mockUpdatedInventory);
    });

    it('should track inventory movement on adjustment', async () => {
      const adjustData = {
        productId: mockProductId,
        locationId: mockLocationId,
        newQuantity: 80,
        reason: 'Damage discovered',
      };

      const mockCurrentInventory = {
        id: 'inv-123',
        quantity: 100,
      };

      tenantDb.inventory.findFirst.mockResolvedValue(mockCurrentInventory);
      tenantDb.$transaction.mockImplementation((callback) =>
        callback(tenantDb)
      );
      tenantDb.inventory.update.mockResolvedValue(mockCurrentInventory);
      tenantDb.inventoryMovement.create.mockResolvedValue({});

      await inventoryService.adjust(mockTenantId, mockUserId, adjustData);

      expect(tenantDb.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ADJUSTMENT',
            quantity: expect.any(Number),
            notes: 'Damage discovered',
          }),
        })
      );
    });
  });


  describe('getById', () => {
    it('should retrieve inventory by id', async () => {
      const mockInventory = {
        id: 'inv-123',
        tenantId: mockTenantId,
        productId: mockProductId,
        quantity: 100,
      };

      tenantDb.inventory.findFirst.mockResolvedValue(mockInventory);

      const result = await inventoryService.getById(mockTenantId, 'inv-123');

      expect(result).toEqual(mockInventory);
    });
  });

  describe('update', () => {
    it('should update inventory fields', async () => {
      const updateData = {
        quantity: 150,
        reservedQuantity: 30,
      };

      const mockUpdatedInventory = {
        id: 'inv-123',
        quantity: 150,
        reservedQuantity: 30,
      };

      tenantDb.inventory.update.mockResolvedValue(mockUpdatedInventory);

      const result = await inventoryService.update(
        mockTenantId,
        'inv-123',
        updateData
      );

      expect(result).toEqual(mockUpdatedInventory);
    });
  });
