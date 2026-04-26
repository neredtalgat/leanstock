import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { logger } from './logger';

export interface TenantContext {
  tenantId: string;
  userId?: string;
  role?: string;
  isSuperAdmin?: boolean;
}

export const asyncLocalStorage = new AsyncLocalStorage<TenantContext>();

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'info' },
    ],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Setup error and warning handlers
prisma.$on('error', (e) => {
  logger.error({ msg: 'Prisma error', error: e });
});

prisma.$on('warn', (e) => {
  logger.warn({ msg: 'Prisma warning', warning: e });
});

// Extension for automatic tenant isolation
export const dbClient = prisma.$extends({
  query: {
    $allModels: {
      async findMany({ args, query }) {
        const context = asyncLocalStorage.getStore();
        if (context && !context.isSuperAdmin) {
          args.where = { ...args.where, tenantId: context.tenantId };
        }
        return query(args);
      },
      async findUnique({ args, query }) {
        const context = asyncLocalStorage.getStore();
        if (context && !context.isSuperAdmin && args.where && typeof args.where === 'object' && 'id' in args.where) {
          args.where = {
            ...args.where,
            tenantId: context.tenantId,
          };
        }
        return query(args);
      },
      async findFirst({ args, query }) {
        const context = asyncLocalStorage.getStore();
        if (context && !context.isSuperAdmin) {
          args.where = { ...args.where, tenantId: context.tenantId };
        }
        return query(args);
      },
      async update({ args, query }) {
        const context = asyncLocalStorage.getStore();
        if (context && !context.isSuperAdmin) {
          args.where = { ...args.where, tenantId: context.tenantId };
        }
        return query(args);
      },
      async delete({ args, query }) {
        const context = asyncLocalStorage.getStore();
        if (context && !context.isSuperAdmin) {
          args.where = { ...args.where, tenantId: context.tenantId };
        }
        return query(args);
      },
      async count({ args, query }) {
        const context = asyncLocalStorage.getStore();
        if (context && !context.isSuperAdmin) {
          args.where = { ...args.where, tenantId: context.tenantId };
        }
        return query(args);
      },
    },
  },
});

export default dbClient;
