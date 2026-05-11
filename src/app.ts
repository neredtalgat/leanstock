import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
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

export function createApp(): Application {
  const app = express();

  // Trust proxy
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Compression
  app.use(compression());

  // Request logging
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
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
      const swaggerDocument = YAML.load('./docs/openapi.yaml');
      swaggerUi.setup(swaggerDocument)(req, res, next);
    });
  } else {
    // Production: load once
    const swaggerDocument = YAML.load('./docs/openapi.yaml');
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
