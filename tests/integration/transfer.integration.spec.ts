import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { transferService } from '../../src/services/transfer.service';
import { config } from '../../src/config/env';
import { ConflictError } from '../../src/utils/errors';

jest.mock('../../src/services/transfer.service', () => ({
  transferService: {
    create: jest.fn(),
    approve: jest.fn(),
    ship: jest.fn(),
    receive: jest.fn(),
    getById: jest.fn(),
    list: jest.fn(),
  },
}));

describe('Transfer API Integration Tests', () => {
  const tenantId = 'test-tenant';
  const userId = 'test-user';
  const sourceLocationId = 'source-location';
  const destinationLocationId = 'destination-location';
  const productId = 'product-1';

  const token = jwt.sign(
    {
      id: userId,
      email: 'manager@example.com',
      role: 'TENANT_ADMIN',
      tenantId,
      type: 'access',
    },
    config.JWT_SECRET,
    { algorithm: 'HS256' }
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /transfers creates transfer with inventory locking handled in service', async () => {
    (transferService.create as jest.Mock).mockResolvedValue({
      id: 'trf-1',
      code: 'TRF-001',
      status: 'APPROVED',
      totalValue: 400,
      requiresApproval: false,
      items: [{ id: 'item-1', productId, quantityShipped: 4, quantityReceived: 0 }],
    });

    const response = await request(app)
      .post('/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceLocationId,
        destinationLocationId,
        items: [{ productId, quantity: 4 }],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(transferService.create).toHaveBeenCalledTimes(1);
  });

  it('transfer prevents overselling (409 Conflict)', async () => {
    (transferService.create as jest.Mock).mockRejectedValue(
      new ConflictError('Insufficient inventory')
    );

    const response = await request(app)
      .post('/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceLocationId,
        destinationLocationId,
        items: [{ productId, quantity: 9999 }],
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it('transfer > $1000 requires approval', async () => {
    (transferService.create as jest.Mock).mockResolvedValue({
      id: 'trf-2',
      code: 'TRF-002',
      status: 'PENDING_APPROVAL',
      totalValue: 1500,
      requiresApproval: true,
      items: [{ id: 'item-2', productId, quantityShipped: 15, quantityReceived: 0 }],
    });

    const response = await request(app)
      .post('/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceLocationId,
        destinationLocationId,
        items: [{ productId, quantity: 15 }],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.requiresApproval).toBe(true);
    expect(response.body.data.status).toBe('PENDING_APPROVAL');
  });
});
