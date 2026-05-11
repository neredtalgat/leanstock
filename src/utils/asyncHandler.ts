import { Response, NextFunction, RequestHandler } from 'express';
import { AuthenticatedRequest } from '../types';

/**
 * Wraps async route handlers to catch errors and pass them to Express error handler
 * 
 * Without this wrapper, if an async function throws an error without try-catch,
 * Express won't catch it and the request will hang.
 * 
 * Usage:
 *   router.get('/', asyncHandler(async (req, res) => {
 *     const data = await service.getData();
 *     res.json(data);
 *   }));
 */
export const asyncHandler = (
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch(next);
  };
};
