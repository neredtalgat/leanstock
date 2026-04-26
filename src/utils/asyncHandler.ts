import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Async handler wrapper for Express routes
 * Eliminates the need for try-catch blocks in route handlers
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error({
        msg: 'Async route error',
        error,
        path: req.path,
        method: req.method,
      });
      next(error);
    });
  };
};

export default asyncHandler;
