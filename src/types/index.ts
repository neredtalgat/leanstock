import { Request } from 'express';
import { UserRole } from '@prisma/client';

export interface JWTPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user?: JWTPayload;
  tenantId?: string;
  requestId?: string;
}

// Helper type for requests with ID param
export interface RequestWithId extends AuthenticatedRequest {
  params: {
    id: string;
    [key: string]: string;
  };
}

export interface PaginationParams {
  cursor?: string;
  limit: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
