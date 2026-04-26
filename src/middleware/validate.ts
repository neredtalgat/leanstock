import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { logger } from '../config/logger';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req.body);
      req.body = data;
      next();
    } catch (error: any) {
      logger.warn({ msg: 'Validation error', error: error.errors });
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.errors,
      });
    }
  };
};

export default validate;
