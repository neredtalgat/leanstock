# HOW TO INTEGRATE THESE FILES INTO YOUR PROJECT

## 1. Replace/merge files in your existing repo:

### Frontend (NEW)
- Copy `frontend/` folder to repo root
- Add to docker-compose.yml: `frontend` service (already in provided docker-compose.yml)

### Backend modifications:

#### A. Update `src/app.ts`:
Add these imports and routes:
```typescript
import { idempotencyMiddleware } from './middleware/idempotency.middleware';
import { healthCheck, readinessCheck } from './controllers/health.controller';
import analyticsRoutes from './routes/analytics.routes';
import deadStockRoutes from './routes/dead-stock.routes';
import authExtraRoutes from './routes/auth.extra.routes';

// Replace existing health endpoint:
app.get('/health', healthCheck);
app.get('/ready', readinessCheck);

// Add routes:
app.use('/analytics', analyticsRoutes);
app.use('/system/dead-stock-rules', deadStockRoutes);
app.use('/auth', authExtraRoutes); // merges with existing auth routes

// Add idempotency to mutation routes (in app.ts or specific routes):
// app.use('/transfers', idempotencyMiddleware, transferRoutes);
```

#### B. Update `src/jobs/index.ts`:
Add reservation worker initialization:
```typescript
import { closeReservationWorker } from '../workers/reservation.worker';

// In initializeJobs(): nothing extra needed (worker auto-starts on import)
// In stopJobs(): add closeReservationWorker()
```

#### C. Update `src/services/transfer.service.ts`:
Replace with `src/services/transfer.service.fixed.ts` content, then rename to `transfer.service.ts`.
Key changes:
- Uses `reservationService.reserve()` on create
- Uses `scheduleReservationExpiry()` for auto-release
- All `transferItem.update` calls happen INSIDE transaction
- On reject: releases reservations back to inventory

#### D. Update `src/services/notification.service.ts`:
Add this method:
```typescript
async notifyTransferReceipt(tenantId: string, transferId: string, toLocationId: string, status: string): Promise<any> {
  const message = `Transfer ${transferId} has been ${status.toLowerCase()} at location ${toLocationId}`;
  const notification = await this.create(tenantId, { type: 'TRANSFER_RECEIPT', message, metadata: { transferId, toLocationId, status } });

  const managers = await this.getManagersForEmail(tenantId);
  for (const manager of managers) {
    emailService.sendBusinessEvent({
      to: manager.email, firstName: manager.firstName || 'Manager',
      eventType: 'success', title: '✅ Transfer Received',
      message: `Transfer ${transferId} has been received and processed.`,
      details: { 'Transfer ID': transferId, 'Status': status, 'Location': toLocationId },
    }).catch(err => logger.error({ err }, 'Failed to send transfer receipt email'));
  }
  return notification;
}
```

#### E. Update `src/services/deadStock.service.ts`:
Replace hardcoded tiers with DB query:
```typescript
const rules = await (tenantDb as any).deadStockRule.findMany({
  where: { tenantId, isActive: true },
  orderBy: { daysThreshold: 'asc' },
});
// Apply highest matching rule instead of hardcoded if/else
```

#### F. Update `src/services/email.service.ts`:
Ensure these methods exist (add if missing):
- `sendVerificationEmail(to, firstName, token)` — queues verification email
- `sendPasswordResetEmail(to, firstName, token)` — queues password reset email

#### G. Update `src/middleware/auth.ts`:
Add email verification check:
```typescript
if (!user.emailVerified && !req.path.includes('/auth/')) {
  return res.status(403).json({ code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email first' });
}
```

#### H. Update `src/routes/transfer.routes.ts`:
Add idempotency middleware:
```typescript
import { idempotencyMiddleware } from '../middleware/idempotency.middleware';
// On POST /:
router.post('/', authenticate, injectTenant, requirePermission('orders:create'), idempotencyMiddleware, validate(CreateTransferInput), transferController.createTransfer);
```

#### I. Update `src/routes/auth.routes.ts`:
Merge with `auth.extra.routes.ts` or import both in `app.ts`.

#### J. Update `src/config/env.ts`:
Add validation for new env vars:
```typescript
EMAIL_API_KEY: z.string().optional(),
JWT_REFRESH_SECRET_KEY: z.string().min(32),
```

## 2. Database migrations:
```bash
# Add new fields if needed (emailVerified already in schema)
npx prisma migrate dev --name add_reservation_fields
# Or ensure existing schema matches
```

## 3. Environment variables:
Copy `.env.example` to `.env` and fill in real values:
- `JWT_REFRESH_SECRET_KEY` (new)
- `EMAIL_API_KEY` (for SendGrid/Mailgun)
- `CORS_ORIGINS` (your deployed domains)

## 4. Testing:
```bash
npm test
# Should run unit + integration tests
```

## 5. Deployment:
```bash
# Local:
docker compose up

# DeployRocks:
# 1. Push to GitHub
# 2. Connect repo to dashboard.deployrocks.com
# 3. Set environment variables in dashboard
# 4. Deploy
```
