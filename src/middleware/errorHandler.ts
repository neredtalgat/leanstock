import { Response, NextFunction, Request } from 'express';
import { logger } from '../config/logger';
import { ErrorResponse } from '../types';

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
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const timestamp = new Date().toISOString();
  const rawError = error as Error & { status?: number; statusCode?: number; expose?: boolean };
  const suggestedStatus = rawError.statusCode || rawError.status;

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

  // CORS middleware can surface disallowed origins as generic errors.
  if (error.message === 'Not allowed by CORS') {
    logger.warn({
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      ip: req.ip,
    }, 'Blocked by CORS policy');

    res.status(403).json({
      code: 'CORS_ORIGIN_NOT_ALLOWED',
      message: 'Request origin is not allowed by CORS policy',
      timestamp,
    });
    return;
  }

  // Respect status hints from body-parser and other middleware (e.g. invalid JSON => 400)
  if (typeof suggestedStatus === 'number' && suggestedStatus >= 400 && suggestedStatus < 500) {
    logger.warn({ err: error }, 'Client request error');
    res.status(suggestedStatus).json({
      code: suggestedStatus === 400 ? 'BAD_REQUEST' : 'REQUEST_ERROR',
      message: rawError.expose ? error.message : 'Request could not be processed',
      timestamp,
    });
    return;
  }

  // Unhandled error
  logger.error({ err: error }, 'Unhandled error');

  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    timestamp,
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
};
