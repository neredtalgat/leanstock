import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        tenantId: string;
        iat?: number;
        exp?: number;
        type?: 'access' | 'refresh';
      };
      tenantId?: string;
    }
  }
}

export {};
