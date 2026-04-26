import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import inventoryRoutes from './routes/inventory.routes';
import { transferRoutes } from './routes/transfer.routes';

const app: Express = express();

// Load Swagger documentation
let swaggerDocument: any = {};
try {
  const swaggerPath = path.join(__dirname, '../docs/openapi.yaml');
  swaggerDocument = YAML.load(swaggerPath);
} catch (error) {
  logger.warn('Swagger documentation not found, skipping API docs');
}

// Trust proxy
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      msg: 'HTTP request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger UI
if (Object.keys(swaggerDocument).length > 0) {
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(swaggerDocument));
}

// Routes
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/transfers', transferRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  logger.warn({ msg: '404 Not found', path: req.path, method: req.method });
  res.status(404).json({
    success: false,
    message: 'Not found',
    path: req.path,
  });
});

// Error handler
app.use(errorHandler);

export default app;
