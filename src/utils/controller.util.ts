import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendError, sendNotFoundError, sendConflictError, sendInternalError } from './response.util';

// Base controller utilities for consistent error handling and responses

export interface ControllerResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Standard error handler for controllers
export const handleControllerError = (
  res: Response,
  error: any,
  requestId?: string,
  customHandlers?: Record<string, (error: any, res: Response, requestId?: string) => void>
) => {
  const errorMessage = error?.message || 'Unknown error';
  
  // Check for custom error handlers first
  if (customHandlers && customHandlers[errorMessage]) {
    customHandlers[errorMessage](error, res, requestId);
    return;
  }
  
  // Default error handling based on common error codes
  switch (errorMessage) {
    case 'NOT_FOUND':
    case 'PRODUCT_NOT_FOUND':
    case 'LOCATION_NOT_FOUND':
    case 'INVENTORY_NOT_FOUND':
    case 'REORDER_POINT_NOT_FOUND':
    case 'TRANSFER_NOT_FOUND':
    case 'PURCHASE_ORDER_NOT_FOUND':
    case 'SUPPLIER_NOT_FOUND':
    case 'USER_NOT_FOUND':
    case 'TENANT_NOT_FOUND':
      sendNotFoundError(res, 'Resource not found', { requestId });
      break;
      
    case 'ALREADY_EXISTS':
    case 'SKU_EXISTS':
    case 'REORDER_POINT_EXISTS':
    case 'EMAIL_ALREADY_EXISTS':
      sendConflictError(res, errorMessage, error, { requestId });
      break;
      
    case 'INSUFFICIENT_PERMISSIONS':
    case 'FORBIDDEN':
      sendError(res, 'FORBIDDEN', 'Access denied', undefined, 403, { requestId });
      break;
      
    case 'UNAUTHORIZED':
    case 'TOKEN_EXPIRED':
    case 'TOKEN_INVALID':
      sendError(res, 'UNAUTHORIZED', errorMessage, undefined, 401, { requestId });
      break;
      
    case 'VALIDATION_ERROR':
    case 'INVALID_QUANTITY':
    case 'INVALID_FORMAT':
      sendError(res, 'VALIDATION_ERROR', errorMessage, error, 400, { requestId });
      break;
      
    default:
      sendInternalError(res, 'Internal server error', { requestId });
      break;
  }
};

// Standard success response handler
export const handleSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  requestId?: string
) => {
  sendSuccess(res, data, statusCode, { requestId });
};

// Standard list response handler
export const handleListResponse = <T>(
  res: Response,
  data: T[],
  pagination: any,
  requestId?: string
) => {
  sendSuccess(res, { data, pagination }, 200, { requestId });
};

// Standard not found handler
export const handleNotFound = (
  res: Response,
  resource: string = 'Resource',
  requestId?: string
) => {
  sendNotFoundError(res, resource, { requestId });
};

// Parameter validation helper
export const validateRequiredParams = (
  params: any,
  required: string[],
  requestId?: string
): { isValid: boolean; missingParams: string[] } => {
  const missing = required.filter(param => !params[param]);
  return {
    isValid: missing.length === 0,
    missingParams: missing
  };
};

// Query parameter helper
export const parseQueryParams = (query: any) => {
  const result: any = {};
  
  for (const key in query) {
    const value = query[key];
    
    if (Array.isArray(value)) {
      result[key] = value[0]; // Take first value for arrays
    } else if (typeof value === 'string') {
      result[key] = value;
    } else {
      result[key] = String(value);
    }
  }
  
  return result;
};

// ID parameter helper
export const getIdParam = (params: any): string => {
  const { id } = params as { id?: string };
  
  if (!id || typeof id !== 'string') {
    throw new Error('INVALID_ID_PARAMETER');
  }
  
  return id;
};

// Tenant validation helper
export const validateTenantAccess = (req: AuthenticatedRequest): string => {
  if (!req.tenantId) {
    throw new Error('TENANT_ACCESS_DENIED');
  }
  
  return req.tenantId;
};

// User validation helper
export const validateUserAccess = (req: AuthenticatedRequest): string => {
  if (!req.user || !req.user.userId) {
    throw new Error('USER_ACCESS_DENIED');
  }
  
  return req.user.userId;
};

// Request context helper
export const getRequestContext = (req: AuthenticatedRequest) => {
  return {
    tenantId: validateTenantAccess(req),
    userId: validateUserAccess(req),
    requestId: (req as AuthenticatedRequest).requestId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    method: req.method,
    path: req.path
  };
};
