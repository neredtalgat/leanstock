import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

let isShuttingDown = false;

export const gracefulShutdownMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (isShuttingDown) {
    res.setHeader('Connection', 'close');
    res.status(503).json({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Server is shutting down',
      timestamp: new Date().toISOString()
    });
    return;
  }
  next();
};

export const setShuttingDown = () => {
  isShuttingDown = true;
  logger.info('Graceful shutdown initiated');
};

export const isGracefulShuttingDown = () => isShuttingDown;
