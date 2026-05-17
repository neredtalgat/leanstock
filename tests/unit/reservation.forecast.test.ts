import { reservationService } from '../../src/services/reservation.service';
import { forecastingService } from '../../src/services/forecasting.service';

jest.mock('../../src/config/redis', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    ttl: jest.fn(),
  },
}));

jest.mock('../../src/config/database', () => ({
  tenantDb: {
    demandHistory: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
    reorderPoint: { findFirst: jest.fn() },
    inventory: { findFirst: jest.fn() },
  },
}));

jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { redis } = require('../../src/config/redis');
const { tenantDb } = require('../../src/config/database');

describe('ReservationService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create reservation', async () => {
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');

    const result = await reservationService.reserve({
      tenantId: 't1', productId: 'p1', locationId: 'l1',
      quantity: 5, referenceType: 'TRANSFER', referenceId: 'tx1',
    });

    expect(result).toBe(true);
    expect(redis.setex).toHaveBeenCalledWith(
      'reservation:t1:p1:l1', 900, expect.any(String)
    );
  });

  it('should reject duplicate reservation', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ quantity: 5 }));

    const result = await reservationService.reserve({
      tenantId: 't1', productId: 'p1', locationId: 'l1',
      quantity: 5, referenceType: 'TRANSFER', referenceId: 'tx2',
    });

    expect(result).toBe(false);
  });

  it('should confirm and remove reservation', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ quantity: 5 }));
    redis.del.mockResolvedValue(1);

    const result = await reservationService.confirm('t1', 'p1', 'l1');
    expect(result).toBe(5);
    expect(redis.del).toHaveBeenCalledWith('reservation:t1:p1:l1');
  });
});

describe('ForecastingService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should calculate moving average forecast', async () => {
    tenantDb.demandHistory.findMany.mockResolvedValue([
      { demandQuantity: 10, date: new Date() },
      { demandQuantity: 20, date: new Date() },
      { demandQuantity: 30, date: new Date() },
    ]);
    tenantDb.reorderPoint.findFirst.mockResolvedValue({ minQuantity: 50 });
    tenantDb.inventory.findFirst.mockResolvedValue({ quantity: 100 });

    const result = await forecastingService.forecast('p1', 't1', 30);

    expect(result.predictedDemand).toBe(600); // avg 20 * 30 days
    expect(result.method).toBe('moving_average');
    expect(result.confidence).toBe('low'); // only 3 data points
  });

  it('should return high confidence with 30+ data points', async () => {
    const history = Array.from({ length: 35 }, (_, i) => ({
      demandQuantity: 10 + i,
      date: new Date(Date.now() - i * 86400000),
    }));
    tenantDb.demandHistory.findMany.mockResolvedValue(history);
    tenantDb.reorderPoint.findFirst.mockResolvedValue(null);
    tenantDb.inventory.findFirst.mockResolvedValue(null);

    const result = await forecastingService.forecast('p1', 't1', 30);
    expect(result.confidence).toBe('high');
  });
});
