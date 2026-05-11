import { Response } from 'express';
import { logger } from '../config/logger';
import { AuthenticatedRequest, ErrorResponse } from '../types';

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: AuthenticatedRequest,
  res: Response,
): void => {
  const timestamp = new Date().toISOString();

  if (error instanceof AppError) {
    logger.warn(`AppError: ${error.code} - ${error.message}`);

    const response: ErrorResponse = {
      code: error.code,
      message: error.message,
      timestamp,
    };

    if (error.details) {
      response.details = error.details;
    }

    res.status(error.statusCode).json(response);
    return;
  }

  // Unhandled error
  logger.error('Unhandled error:', error);

  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    timestamp,
  });
};

export const notFoundHandler = (req: AuthenticatedRequest, res: Response): void => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
};
