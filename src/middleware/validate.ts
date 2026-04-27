import { Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const validate = (schema: ZodSchema) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: {
            errors: formattedErrors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Validation error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Query validation failed',
          details: {
            errors: formattedErrors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Validation error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  };
};

export const validateParams = (schema: ZodSchema) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Path parameters validation failed',
          details: {
            errors: formattedErrors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Validation error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  };
};
