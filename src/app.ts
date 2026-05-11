import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { randomUUID } from 'crypto';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import transferRoutes from './routes/transfer.routes';
import inventoryRoutes from './routes/inventory.routes';
import locationRoutes from './routes/location.routes';
import auditRoutes from './routes/audit.routes';
import reportRoutes from './routes/report.routes';
import purchaseOrderRoutes from './routes/purchase-order.routes';
import supplierRoutes from './routes/supplier.routes';
import reorderPointRoutes from './routes/reorder-point.routes';
import analyticsRoutes from './routes/analytics.routes';
import systemSettingsRoutes from './routes/system-settings.routes';
import supplierReturnRoutes from './routes/supplier-return.routes';
import notificationRoutes from './routes/notification.routes';
import tenantRoutes from './routes/tenant.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './config/logger';
import { db } from './config/database';
import { AuthenticatedRequest } from './types';

export function createApp(): Application {
  const app = express();

  // Trust proxy
  app.set('trust proxy', 1);

  // Request ID middleware (for tracing)
  app.use((req, res, next) => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    (req as AuthenticatedRequest).requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Enhanced security headers
  app.use(helmet({
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
    hidePoweredBy: true,
    referrerPolicy: { policy: 'no-referrer' },
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
  }));

  // Enhanced CORS configuration
  app.use(cors({
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
      
      if (!origin) return callback(null, true);
      
      if (process.env.NODE_ENV === 'production') {
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'), false);
        }
      } else {
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
    maxAge: 86400,
  }));

  // Rate limiting
  app.use(rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Too many requests from this IP, please try again later.',
    legacyHeaders: false,
    standardHeaders: true,
    keyGenerator: (req) => {
      return (req.ip || 'unknown') + ((req as AuthenticatedRequest).user?.userId || 'anonymous');
    },
    skip: (req) => {
      return req.path === '/health' || req.path === '/api-docs';
    },
  } as any));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Compression
  app.use(compression());

  // Enhanced request logging
  app.use((req, _res, next) => {
    logger.info({
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: (req as AuthenticatedRequest).requestId,
      timestamp: new Date().toISOString()
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
    });
  });

  // API documentation (Swagger UI)
  if (process.env.NODE_ENV === 'development') {
    // Hot reload: load YAML on every request in development
    app.use('/api-docs', swaggerUi.serve, (req, res, next) => {
      const swaggerDocument = YAML.load('./openapi.yaml');
      swaggerUi.setup(swaggerDocument)(req, res, next);
    });
  } else {
    // Production: load once
    const swaggerDocument = YAML.load('./openapi.yaml');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }

  // API routes
  app.use('/auth', authRoutes);
  app.use('/products', productRoutes);
  app.use('/transfers', transferRoutes);
  app.use('/inventory', inventoryRoutes);
  app.use('/locations', locationRoutes);
  app.use('/audit-logs', auditRoutes);
  app.use('/reports', reportRoutes);
  app.use('/purchase-orders', purchaseOrderRoutes);
  app.use('/suppliers', supplierRoutes);
  app.use('/reorder-points', reorderPointRoutes);
  app.use('/analytics', analyticsRoutes);
  app.use('/system', systemSettingsRoutes);
  app.use('/supplier-returns', supplierReturnRoutes);
  app.use('/notifications', notificationRoutes);
  app.use('/tenants', tenantRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
