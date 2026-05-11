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
      // Prisma's $on method has incomplete type definitions for event payloads
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaInstance.$on('query' as never, (e: { query: string; duration: number }) => {
        logger.debug(`Query: ${e.query}`);
        logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // Prisma's $on method typing doesn't include the 'error' event payload type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaInstance.$on('error' as never, (e: { message: string }) => {
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
        async create({ args, query }) {
          const store = asyncLocalStorage.getStore();
          if (store?.tenantId && !store?.isSuperAdmin) {
            const mutableArgs = args as any;
            mutableArgs.data = { ...mutableArgs.data, tenantId: store.tenantId };
          }
          return query(args);
        },
        async createMany({ args, query }) {
          const store = asyncLocalStorage.getStore();
          if (store?.tenantId && !store?.isSuperAdmin) {
            const mutableArgs = args as any;
            if (Array.isArray(mutableArgs.data)) {
              mutableArgs.data = mutableArgs.data.map((item: any) => ({ ...item, tenantId: store.tenantId }));
            } else {
              mutableArgs.data = { ...mutableArgs.data, tenantId: store.tenantId };
            }
          }
          return query(args);
        },
        async findMany({ args, query }) {
          const store = asyncLocalStorage.getStore();
          if (store?.tenantId && !store?.isSuperAdmin) {
            args.where = { ...args.where, tenantId: store.tenantId };
          }
          return query(args);
        },
        async findUnique({ args, query }) {
          const store = asyncLocalStorage.getStore();
          if (store?.tenantId && !store?.isSuperAdmin) {
            throw new Error('UNSAFE_FIND_UNIQUE_IN_TENANT_CONTEXT');
          }
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
          const store = asyncLocalStorage.getStore();
          if (store?.tenantId && !store?.isSuperAdmin) {
            throw new Error('UNSAFE_DELETE_IN_TENANT_CONTEXT');
          }
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
