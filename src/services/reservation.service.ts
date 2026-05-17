import { redis } from '../config/redis';
import { logger } from '../config/logger';

export interface ReservationInput {
  tenantId: string;
  productId: string;
  locationId: string;
  quantity: number;
  ttlSeconds?: number;
  referenceType: 'TRANSFER' | 'CHECKOUT' | 'PURCHASE_ORDER';
  referenceId: string;
}

const RESERVATION_PREFIX = 'reservation';
const DEFAULT_TTL = 900;

class ReservationService {
  private key(tenantId: string, productId: string, locationId: string): string {
    return `${RESERVATION_PREFIX}:${tenantId}:${productId}:${locationId}`;
  }

  async reserve(input: ReservationInput): Promise<boolean> {
    const key = this.key(input.tenantId, input.productId, input.locationId);
    const ttl = input.ttlSeconds || DEFAULT_TTL;
    const value = JSON.stringify({
      quantity: input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdAt: new Date().toISOString(),
    });

    const existing = await redis.get(key);
    if (existing) {
      logger.warn({ key }, 'Reservation already exists');
      return false;
    }

    await redis.setex(key, ttl, value);
    logger.info({ key, ttl, quantity: input.quantity }, 'Reservation created');
    return true;
  }

  async confirm(tenantId: string, productId: string, locationId: string): Promise<number | null> {
    const key = this.key(tenantId, productId, locationId);
    const data = await redis.get(key);
    if (!data) return null;
    const parsed = JSON.parse(data);
    await redis.del(key);
    logger.info({ key }, 'Reservation confirmed');
    return parsed.quantity;
  }

  async release(tenantId: string, productId: string, locationId: string): Promise<boolean> {
    const key = this.key(tenantId, productId, locationId);
    const deleted = await redis.del(key);
    if (deleted) {
      logger.info({ key }, 'Reservation released');
      return true;
    }
    return false;
  }

  async listActive(tenantId: string): Promise<Array<{
    productId: string;
    locationId: string;
    quantity: number;
    ttlRemaining: number;
  }>> {
    const pattern = `${RESERVATION_PREFIX}:${tenantId}:*`;
    const keys = await redis.keys(pattern);
    const result = [];
    for (const key of keys) {
      const data = await redis.get(key);
      const ttl = await redis.ttl(key);
      if (data) {
        const parsed = JSON.parse(data);
        const parts = key.split(':');
        result.push({ productId: parts[3], locationId: parts[4], quantity: parsed.quantity, ttlRemaining: ttl });
      }
    }
    return result;
  }
}

export const reservationService = new ReservationService();
