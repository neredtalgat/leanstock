import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error({
    msg: 'Unhandled error',
    error: err,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  const status = err?.statusCode ?? err?.status;
  if (status && err?.message) {
    return res.status(status).json({
      success: false,
      message: err.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

export default errorHandler;
