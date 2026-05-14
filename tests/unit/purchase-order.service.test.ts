import { purchaseOrderService } from '../../src/services/purchase-order.service';
import { CreatePurchaseOrderInput } from '../../src/services/purchase-order.service';

jest.mock('../../src/config/database', () => ({
  tenantDb: {
    purchaseOrder: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    purchaseOrderItem: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    supplier: {
      findFirst: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    supplierProduct: {
      findUnique: jest.fn(),
    },
    inventory: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
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

const { tenantDb } = jest.requireMock('../../src/config/database');

describe('PurchaseOrderService', () => {
  const mockTenantId = 'tenant-123';
  const mockSupplierId = 'supplier-123';
  const mockProductId = 'prod-123';
  const mockUserId = 'user-123';
  const mockLocationId = 'loc-123';

  beforeEach(() => {
    jest.clearAllMocks();
    tenantDb.$transaction.mockImplementation((callback) =>
      callback(tenantDb)
    );
  });

  describe('create', () => {
    it('should create purchase order with items', async () => {
      const createData: CreatePurchaseOrderInput = {
        supplierId: mockSupplierId,
        items: [
          {
            productId: mockProductId,
            quantity: 50,
            unitPrice: 100,
          },
        ],
        expectedDeliveryDate: '2025-06-01',
      };

      const mockSupplier = {
        id: mockSupplierId,
      };

      const mockProduct = {
        id: mockProductId,
      };

      const mockPurchaseOrder = {
        id: 'po-123',
        tenantId: mockTenantId,
        supplierId: mockSupplierId,
        status: 'DRAFT',
        expectedDeliveryDate: createData.expectedDeliveryDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      tenantDb.supplier.findFirst.mockResolvedValue(mockSupplier);
      tenantDb.product.findFirst.mockResolvedValue(mockProduct);
      tenantDb.purchaseOrder.create.mockResolvedValue(mockPurchaseOrder);

      const result = await purchaseOrderService.create(
        mockTenantId,
        mockUserId,
        createData
      );

      expect(result.status).toBe('DRAFT');
      expect(result.supplierId).toBe(mockSupplierId);
    });

    it('should reject invalid supplier', async () => {
      const createData: CreatePurchaseOrderInput = {
        supplierId: 'invalid-supplier',
        items: [],
      };

      tenantDb.supplier.findFirst.mockResolvedValue(null);

      await expect(
        purchaseOrderService.create(mockTenantId, mockUserId, createData)
      ).rejects.toThrow('SUPPLIER_NOT_FOUND');
    });

    it('should reject invalid product', async () => {
      const createData: CreatePurchaseOrderInput = {
        supplierId: mockSupplierId,
        items: [
          {
            productId: 'invalid-product',
            quantity: 50,
            unitPrice: 100,
          },
        ],
      };

      tenantDb.supplier.findFirst.mockResolvedValue({ id: mockSupplierId });
      tenantDb.product.findFirst.mockResolvedValue(null);

      await expect(
        purchaseOrderService.create(mockTenantId, mockUserId, createData)
      ).rejects.toThrow(expect.stringMatching(/PRODUCT_NOT_FOUND/));
    });
  });

  describe('update', () => {
    it('should update purchase order status', async () => {
      const poId = 'po-123';
      const updateData = {
        status: 'CONFIRMED' as const,
      };

      const mockPurchaseOrder = {
        id: poId,
        status: 'DRAFT',
        items: [],
        tenantId: mockTenantId,
      };

      const mockUpdatedPO = {
        ...mockPurchaseOrder,
        status: 'CONFIRMED',
      };

      tenantDb.purchaseOrder.findFirst.mockResolvedValue(mockPurchaseOrder);
      tenantDb.purchaseOrder.update.mockResolvedValue(mockUpdatedPO);

      const result = await purchaseOrderService.update(
        mockTenantId,
        poId,
        mockUserId,
        updateData
      );

      expect(result.status).toBe('CONFIRMED');
    });
  });

  describe('receive', () => {
    it('should receive items from purchase order', async () => {
      const poId = 'po-123';
      const receiveData = {
        items: [
          {
            productId: mockProductId,
            quantityReceived: 30,
          },
        ],
      };

      const mockPurchaseOrder = {
        id: poId,
        status: 'CONFIRMED',
        items: [
          {
            productId: mockProductId,
            quantity: 50,
            receivedQuantity: 0,
          },
        ],
        tenantId: mockTenantId,
      };

      const mockProduct = {
        id: mockProductId,
        baseCost: 100,
      };

      const mockUpdatedPO = {
        ...mockPurchaseOrder,
        status: 'RECEIVING',
        items: [
          {
            ...mockPurchaseOrder.items[0],
            receivedQuantity: 30,
          },
        ],
      };

      tenantDb.purchaseOrder.findFirst.mockResolvedValue(mockPurchaseOrder);
      tenantDb.product.findFirst.mockResolvedValue(mockProduct);
      tenantDb.inventory.findFirst.mockResolvedValue({
        quantity: 0,
      });
      tenantDb.purchaseOrder.update.mockResolvedValue(mockUpdatedPO);

      const result = await purchaseOrderService.receive(
        mockTenantId,
        poId,
        mockUserId,
        receiveData
      );

      expect(result.status).toBe('RECEIVING');
    });

    it('should mark PO completed when all items received', async () => {
      const poId = 'po-123';
      const receiveData = {
        items: [
          {
            productId: mockProductId,
            quantityReceived: 50,
          },
        ],
      };

      const mockPurchaseOrder = {
        id: poId,
        status: 'CONFIRMED',
        items: [
          {
            productId: mockProductId,
            quantity: 50,
            receivedQuantity: 0,
          },
        ],
        tenantId: mockTenantId,
      };

      const mockProduct = {
        id: mockProductId,
        baseCost: 100,
      };

      const mockUpdatedPO = {
        ...mockPurchaseOrder,
        status: 'COMPLETED',
        items: [
          {
            ...mockPurchaseOrder.items[0],
            receivedQuantity: 50,
          },
        ],
      };

      tenantDb.purchaseOrder.findFirst.mockResolvedValue(mockPurchaseOrder);
      tenantDb.product.findFirst.mockResolvedValue(mockProduct);
      tenantDb.inventory.findFirst.mockResolvedValue({
        quantity: 0,
      });
      tenantDb.purchaseOrder.update.mockResolvedValue(mockUpdatedPO);

      const result = await purchaseOrderService.receive(
        mockTenantId,
        poId,
        mockUserId,
        receiveData
      );

      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('list', () => {
    it('should list purchase orders', async () => {
      const mockPOs = [
        {
          id: 'po-1',
          supplierId: mockSupplierId,
          status: 'CONFIRMED',
          items: [],
          supplier: { id: mockSupplierId, name: 'Supplier A' },
        },
      ];

      tenantDb.purchaseOrder.findMany.mockResolvedValue(mockPOs);

      const result = await purchaseOrderService.list(mockTenantId);

      expect(Array.isArray(result)).toBe(true);
      expect(tenantDb.purchaseOrder.findMany).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      const mockPOs = [
        {
          id: 'po-1',
          status: 'DRAFT',
          items: [],
          supplier: {},
        },
      ];

      tenantDb.purchaseOrder.findMany.mockResolvedValue(mockPOs);

      await purchaseOrderService.list(mockTenantId, 'DRAFT');

      expect(tenantDb.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'DRAFT',
          }),
        })
      );
    });
  });
});
