import { AsyncLocalStorage } from 'async_hooks';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Store tenant context
export const asyncLocalStorage = new AsyncLocalStorage<{ tenantId?: string; isSuperAdmin?: boolean }>();

let prismaInstance: PrismaClient;

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      // @ts-expect-error - Prisma event types
      prismaInstance.$on('query', (e: any) => {
        logger.debug(`Query: ${e.query}`);
        logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // @ts-expect-error - Prisma event types
    prismaInstance.$on('error', (e: any) => {
      logger.error(`Database error: ${e.message}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      await prismaInstance.$disconnect();
    });
  }

  return prismaInstance;
}

export const db = getPrisma();

// Extend Prisma Client to add tenant isolation
export const createTenantAwareDb = () => {
  const prisma = db.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          const store = asyncLocalStorage.getStore();
          if (store?.tenantId && !store?.isSuperAdmin) {
            args.where = { ...args.where, tenantId: store.tenantId };
          }
          return query(args);
        },
        async findUnique({ args, query }) {
          return query(args);
        },
        async findFirst({ args, query }) {
          const store = asyncLocalStorage.getStore();
          if (store?.tenantId && !store?.isSuperAdmin) {
            args.where = { ...args.where, tenantId: store.tenantId };
          }
          return query(args);
        },
        async update({ args, query }) {
          const store = asyncLocalStorage.getStore();
          if (store?.tenantId && !store?.isSuperAdmin) {
            args.where = { ...args.where, tenantId: store.tenantId };
          }
          return query(args);
        },
        async updateMany({ args, query }) {
          const store = asyncLocalStorage.getStore();
          if (store?.tenantId && !store?.isSuperAdmin) {
            args.where = { ...args.where, tenantId: store.tenantId };
          }
          return query(args);
        },
        async delete({ args, query }) {
          return query(args);
        },
        async deleteMany({ args, query }) {
          const store = asyncLocalStorage.getStore();
          if (store?.tenantId && !store?.isSuperAdmin) {
            args.where = { ...args.where, tenantId: store.tenantId };
          }
          return query(args);
        },
        async count({ args, query }) {
          const store = asyncLocalStorage.getStore();
          if (store?.tenantId && !store?.isSuperAdmin) {
            args.where = { ...args.where, tenantId: store.tenantId };
          }
          return query(args);
        },
      },
    },
  });

  return prisma;
};

export const tenantDb = createTenantAwareDb();
