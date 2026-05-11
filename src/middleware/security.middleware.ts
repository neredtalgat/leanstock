import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { logger } from '../config/logger';

// Enhanced security headers configuration
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.CORS_ORIGIN || "http://localhost:3000"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  
  // Hide Express information
  hidePoweredBy: true,
  
  // No referrer policy
  referrerPolicy: { policy: 'no-referrer' },
  
  // HSTS (only in production with HTTPS)
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  
  // X-Frame-Options
  frameguard: { action: 'deny' },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection
  xssFilter: true,
});

// Enhanced CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV === 'production') {
      // Strict origin checking in production
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    } else {
      // More permissive in development
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Tenant-ID',
    'X-Request-ID'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Request-ID',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  maxAge: 86400, // 24 hours
};

// Rate limiting configuration
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  // @ts-expect-error express-rate-limit types
  keyGenerator: (req: Request) => {
    // Use IP + user ID for more granular rate limiting
    return req.ip + ((req as Request & { user?: { id?: string } }).user?.id || 'anonymous');
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api-docs';
  },
});

// Request ID middleware
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  
  // Add to request object
  req.requestId = requestId;
  
  // Add to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Add to logger context
  logger.child({ requestId });
  
  next();
};

// Security audit middleware
export const securityAuditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log security-relevant information
  if (req.path.startsWith('/auth') || req.path.startsWith('/tenants')) {
    logger.warn('Security-sensitive request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
  
  // Continue to next middleware
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (res.statusCode >= 400) {
      logger.warn('Security audit - error response', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        ip: req.ip,
        requestId: req.requestId,
        duration,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  next();
};

// IP whitelist middleware (optional)
export const ipWhitelistMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const whitelist = process.env.IP_WHITELIST?.split(',') || [];
  
  if (whitelist.length === 0) {
    return next(); // No whitelist configured
  }
  
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (whitelist.includes(clientIP)) {
    next();
  } else {
    logger.warn('Blocked request from non-whitelisted IP', {
      ip: clientIP,
      path: req.path,
      requestId: req.requestId
    });
    
    res.status(403).json({
      code: 'IP_BLOCKED',
      message: 'Access denied from this IP address',
      requestId: req.requestId
    });
  }
};

// API key validation middleware (for API access)
export const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  // Skip API key validation for auth endpoints and health checks
  if (req.path.startsWith('/auth') || req.path === '/health' || req.path === '/api-docs') {
    return next();
  }
  
  if (!apiKey) {
    return res.status(401).json({
      code: 'API_KEY_REQUIRED',
      message: 'API key is required for this endpoint',
      requestId: req.requestId
    });
  }
  
  // Validate API key format and existence
  // This would typically check against database
  // For now, just validate format
  if (!apiKey.startsWith('lsk_') || apiKey.length < 32) {
    return res.status(401).json({
      code: 'INVALID_API_KEY',
      message: 'Invalid API key format',
      requestId: req.requestId
    });
  }
  
  // Add API key info to request for downstream middleware
  req.apiKey = apiKey;
  
  next();
};

// Content validation middleware
export const contentValidationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'];
  
  // Validate content type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const allowedTypes = [
      'application/json',
      'multipart/form-data',
      'application/x-www-form-urlencoded'
    ];
    
    if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
      return res.status(415).json({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Content type not supported',
        requestId: req.requestId
      });
    }
  }
  
  next();
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      apiKey?: string;
      user?: { id?: string };
    }
  }
}
