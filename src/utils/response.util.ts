import { Response } from 'express';

// Standard API Response Structure
export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
    version: string;
  };
}

// Standard Pagination Structure
export interface PaginationInfo {
  cursor?: string;
  hasMore: boolean;
  count?: number;
  limit?: number;
  total?: number;
}

// Standard List Response Structure
export interface ListResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationInfo;
}

// Standard Error Response Structure
export interface ErrorResponse extends ApiResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Response utility functions
export const createSuccessResponse = <T>(
  data: T,
  meta?: {
    requestId?: string;
    pagination?: PaginationInfo;
  }
): ApiResponse<T> => ({
  data,
  meta: {
    requestId: meta?.requestId,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    ...meta && { pagination: meta.pagination }
  }
});

export const createListResponse = <T>(
  data: T[],
  pagination: PaginationInfo,
  meta?: {
    requestId?: string;
  }
): ListResponse<T> => ({
  data,
  pagination,
  meta: {
    requestId: meta?.requestId,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }
});

export const createErrorResponse = (
  code: string,
  message: string,
  details?: any,
  meta?: {
    requestId?: string;
  statusCode?: number;
  timestamp?: string;
  version?: string;
  }
): ErrorResponse => ({
  error: {
    code,
    message,
    ...(details && { details })
  },
  meta: {
    requestId: meta?.requestId,
    timestamp: meta?.timestamp || new Date().toISOString(),
    version: meta?.version || '1.0.0',
    ...(meta?.statusCode && { statusCode: meta.statusCode })
  }
});

// Standard HTTP Status Codes for API
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// Standard Error Codes
export const ErrorCode = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Authorization errors
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  FORBIDDEN: 'FORBIDDEN',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  SKU_EXISTS: 'SKU_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  
  // Business logic errors
  INSUFFICIENT_INVENTORY: 'INSUFFICIENT_INVENTORY',
  TRANSFER_NOT_APPROVED: 'TRANSFER_NOT_APPROVED',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Security
  IP_BLOCKED: 'IP_BLOCKED',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  API_KEY_REQUIRED: 'API_KEY_REQUIRED',
  API_KEY_INVALID: 'API_KEY_INVALID'
} as const;

// Response helper functions for Express
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = HttpStatus.OK,
  meta?: {
    requestId?: string;
    pagination?: PaginationInfo;
  }
): void => {
  const response = createSuccessResponse(data, meta);
  res.status(statusCode).json(response);
};

export const sendList = <T>(
  res: Response,
  data: T[],
  pagination: PaginationInfo,
  statusCode: number = HttpStatus.OK,
  meta?: {
    requestId?: string;
  }
): void => {
  const response = createListResponse(data, pagination, meta);
  res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
  details?: any,
  meta?: {
    requestId?: string;
    timestamp?: string;
    version?: string;
  }
): void => {
  const response = createErrorResponse(code, message, details, {
    ...meta,
    statusCode
  });
  res.status(statusCode).json(response);
};

export const sendValidationError = (
  res: Response,
  message: string,
  details?: any,
  meta?: {
    requestId?: string;
  }
): void => {
  sendError(res, ErrorCode.VALIDATION_ERROR, message, HttpStatus.BAD_REQUEST, details, meta);
};

export const sendNotFoundError = (
  res: Response,
  resource: string = 'Resource',
  meta?: {
    requestId?: string;
  }
): void => {
  sendError(res, ErrorCode.NOT_FOUND, `${resource} not found`, HttpStatus.NOT_FOUND, undefined, meta);
};

export const sendUnauthorizedError = (
  res: Response,
  message: string = 'Unauthorized',
  meta?: {
    requestId?: string;
  }
): void => {
  sendError(res, ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED, undefined, meta);
};

export const sendForbiddenError = (
  res: Response,
  message: string = 'Forbidden',
  meta?: {
    requestId?: string;
  }
): void => {
  sendError(res, ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN, undefined, meta);
};

export const sendConflictError = (
  res: Response,
  message: string,
  details?: any,
  meta?: {
    requestId?: string;
  }
): void => {
  sendError(res, ErrorCode.RESOURCE_CONFLICT, message, HttpStatus.CONFLICT, details, meta);
};

export const sendInternalError = (
  res: Response,
  message: string = 'Internal server error',
  meta?: {
    requestId?: string;
  }
): void => {
  sendError(res, ErrorCode.INTERNAL_ERROR, message, HttpStatus.INTERNAL_SERVER_ERROR, undefined, meta);
};
