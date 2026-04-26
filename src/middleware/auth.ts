import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { logger } from '../config/logger';

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET, {
        algorithms: ['HS256'],
      }) as JWTPayload;

      if (decoded.type !== 'access') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token type',
        });
      }

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        tenantId: decoded.tenantId,
        type: decoded.type,
      };

      req.tenantId = decoded.tenantId;

      next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error({ msg: 'Authentication error', error });
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

export default authenticate;
