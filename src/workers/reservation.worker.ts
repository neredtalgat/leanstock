import { Worker, Queue } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { tenantDb, asyncLocalStorage } from '../config/database';

interface ReservationExpiryJob {
  tenantId: string;
  productId: string;
  locationId: string;
  quantity: number;
}

const reservationExpiryQueue = new Queue('reservation-expiry', { connection: redis });

export const reservationExpiryWorker = new Worker(
  'reservation-expiry',
  async (job) => {
    const { tenantId, productId, locationId, quantity } = job.data as ReservationExpiryJob;
    logger.info({ tenantId, productId, locationId, jobId: job.id }, 'Processing reservation expiry');

    await asyncLocalStorage.run({ tenantId }, async () => {
      const inv = await (tenantDb as any).inventory.findFirst({
        where: { tenantId, productId, locationId },
      });
      if (!inv) {
        logger.warn({ tenantId, productId, locationId }, 'Inventory not found for expiry release');
        return;
      }

      const key = `reservation:${tenantId}:${productId}:${locationId}`;
      const stillReserved = await redis.get(key);
      if (stillReserved) {
        logger.info({ key }, 'Reservation still active, skipping expiry');
        return;
      }

      await (tenantDb as any).inventory.update({
        where: { id: inv.id },
        data: { reservedQuantity: Math.max(0, inv.reservedQuantity - quantity) },
      });

      await (tenantDb as any).inventoryMovement.create({
        data: {
          tenantId,
          inventoryId: inv.id,
          type: 'ADJUSTMENT',
          quantity: quantity,
          notes: 'Auto-release expired reservation',
        },
      });

      logger.info({ tenantId, productId, locationId, releasedQty: quantity }, 'Expired reservation released');
    });
  },
  { connection: redis, concurrency: 5 },
);

reservationExpiryWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Reservation expiry job completed');
});

reservationExpiryWorker.on('failed', (job, err) => {
  logger.error({ err, jobId: job?.id }, 'Reservation expiry job failed');
});

export async function scheduleReservationExpiry(
  tenantId: string, productId: string, locationId: string, quantity: number, delayMs: number = 900000
): Promise<void> {
  await reservationExpiryQueue.add(
    'release-expired',
    { tenantId, productId, locationId, quantity },
    { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  );
  logger.info({ tenantId, productId, locationId, delayMs }, 'Scheduled reservation expiry job');
}

export async function closeReservationWorker(): Promise<void> {
  await reservationExpiryWorker.close();
  await reservationExpiryQueue.close();
}

export { reservationExpiryQueue };
