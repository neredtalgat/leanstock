// Common test utilities and fixtures
import { UserRole } from '@prisma/client';

export const mockTenantId = 'tenant-123';
export const mockUserId = 'user-123';
export const mockProductId = 'prod-123';
export const mockLocationId = 'loc-123';
export const mockSupplierId = 'supplier-123';

export const mockUser = {
  id: mockUserId,
  email: 'test@example.com',
  passwordHash: 'hashedpassword',
  firstName: 'Test',
  lastName: 'User',
  role: UserRole.STORE_ASSOCIATE,
  tenantId: mockTenantId,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockTenant = {
  id: mockTenantId,
  name: 'Test Tenant',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockProduct = {
  id: mockProductId,
  tenantId: mockTenantId,
  sku: 'SKU-001',
  name: 'Test Product',
  description: 'A test product',
  baseCost: 100,
  retailPrice: 150,
  weight: 1.5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockLocation = {
  id: mockLocationId,
  tenantId: mockTenantId,
  name: 'Warehouse A',
  type: 'warehouse',
  address: '123 Main St',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockSupplier = {
  id: mockSupplierId,
  tenantId: mockTenantId,
  name: 'Supplier A',
  email: 'supplier@example.com',
  phone: '+1234567890',
  address: '456 Supplier St',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockInventory = {
  id: 'inv-123',
  tenantId: mockTenantId,
  productId: mockProductId,
  locationId: mockLocationId,
  quantity: 100,
  reservedQuantity: 20,
  inTransit: 5,
  daysInInventory: 30,
  lastMovedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const createMockTransferOrder = (overrides = {}) => ({
  id: 'transfer-123',
  tenantId: mockTenantId,
  fromLocationId: mockLocationId,
  toLocationId: 'loc-to-456',
  status: 'DRAFT',
  totalValue: 500,
  requiresApproval: false,
  notes: 'Test transfer',
  createdBy: mockUserId,
  approvedBy: null,
  approvedAt: null,
  rejectionReason: null,
  carrier: null,
  trackingNumber: null,
  shippedAt: null,
  receivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockPurchaseOrder = (overrides = {}) => ({
  id: 'po-123',
  tenantId: mockTenantId,
  supplierId: mockSupplierId,
  status: 'DRAFT',
  expectedDeliveryDate: new Date('2025-06-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockInventoryMovement = (overrides = {}) => ({
  id: 'mov-123',
  tenantId: mockTenantId,
  inventoryId: mockInventory.id,
  type: 'IN',
  quantity: 50,
  referenceId: null,
  notes: null,
  createdAt: new Date(),
  ...overrides,
});

// Helper to wait for async operations
export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Helper to create JWT token for testing
export const createMockJWT = (payload: any, expiresIn = '1h') => {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = 'mock-signature';
  return `${header}.${body}.${signature}`;
};

// Helper to create mock request context
export const createMockRequestContext = (overrides = {}) => ({
  tenantId: mockTenantId,
  userId: mockUserId,
  userRole: UserRole.STORE_ASSOCIATE,
  ...overrides,
});
