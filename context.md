0.1. Инициализация проекта
plain
Copy
mkdir leanstock && cd leanstock
npm init -y
0.2. Установка зависимостей
bash
Copy
# Core
npm install express@4.18.2 cors helmet compression
npm install prisma@5.7.0 @prisma/client
npm install jsonwebtoken bcryptjs
npm install zod
npm install ioredis bullmq
npm install swagger-ui-express yamljs
npm install pino pino-pretty

# Dev
npm install -D typescript @types/express @types/node @types/bcryptjs @types/jsonwebtoken @types/cors @types/compression @types/swagger-ui-express
npm install -D jest @types/jest ts-jest supertest @types/supertest
npm install -D nodemon ts-node eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier
0.3. Инициализация TypeScript и Prisma
bash
Copy
npx tsc --init
npx prisma init
0.4. Создание файловой структуры (из 06-project-structure.txt):
plain
Copy
leanstock/
├── src/
│   ├── config/         # env.ts, database.ts, redis.ts, logger.ts
│   ├── middleware/     # auth.ts, tenant.ts, rbac.ts, rateLimit.ts, errorHandler.ts, validate.ts
│   ├── schemas/        # zod schemas
│   ├── services/       # business logic
│   ├── controllers/    # HTTP handlers
│   ├── routes/         # route definitions
│   ├── jobs/           # background workers
│   ├── utils/          # helpers
│   ├── types/          # TypeScript augmentations
│   ├── app.ts          # Express app
│   └── server.ts       # entry point
├── prisma/
│   ├── schema.prisma   # из 03-database-schema-fixed.txt
│   └── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── setup.ts
├── docs/
│   └── openapi.yaml    # из 04-openapi-fixed.yaml
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .github/workflows/ci.yml
├── jest.config.js
├── tsconfig.json
└── package.json
Этап 1: Конфигурация и инфраструктура (2–3 часа)
1.1. src/config/env.ts — валидация окружения через Zod
NODE_ENV, PORT, DATABASE_URL, REDIS_URL
JWT_SECRET (min 32 chars), JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN
BCRYPT_ROUNDS
RATE_LIMIT_*
Fail-fast: если секреты отсутствуют или слабые — process.exit(1)
1.2. src/config/database.ts — Prisma Client с RLS extension
TypeScript
Copy
// Ключевой момент: SET LOCAL для каждого запроса/транзакции
// Использовать AsyncLocalStorage для tenant context
1.3. src/config/redis.ts — подключение к Redis, загрузка Lua-скриптов
1.4. src/config/logger.ts — Pino logger
1.5. docker-compose.yml — PostgreSQL 15 + Redis 7 + App
yaml
Copy
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: leanstock
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: leanstock
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://leanstock:${DB_PASSWORD}@postgres:5432/leanstock
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
Этап 2: База данных и миграции (2–3 часа)
2.1. Перенести schema.prisma из 03-database-schema-fixed.txt
Все модели: Tenant, User, ApiKey, Location, BinLocation, Product, ProductImage, ProductVariant, Inventory, InventoryMovement, TransferOrder, TransferItem, Supplier, SupplierProduct, PurchaseOrder, PurchaseOrderItem, ReorderPoint, DemandHistory, DeadStockRule, PriceHistory, Notification, AuditLog
Важно: @@unique, @@index, dbgenerated для RLS
2.2. Первая миграция
bash
Copy
npx prisma migrate dev --name init
2.3. Добавить RLS SQL в сгенерированный migration.sql
ENABLE ROW LEVEL SECURITY для всех таблиц
FORCE ROW LEVEL SECURITY для критичных
CREATE POLICY tenant_isolation_* через create_tenant_policy() helper
CREATE FUNCTION current_tenant_id(), is_super_admin()
CREATE FUNCTION calculate_days_in_inventory()
CREATE TRIGGER trigger_calc_days_in_inventory
CHECK constraints (все из fixed schema)
Indexes для cursor pagination, dead stock, barcode
2.4. Seed-данные для тестирования
TypeScript
Copy
// prisma/seed.ts
// Создать: 1 tenant, 2 locations, 2 products, 1 admin user (bcrypt hash)
Этап 3: Аутентификация и авторизация (4–5 часа) — MANDATORY BASELINE
Это 20% проекта, и оно блокирует всё остальное. Должно быть 100% готово.
3.1. Zod schemas (src/schemas/auth.schema.ts)
TypeScript
Copy
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
    .regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.nativeEnum(UserRole).default(UserRole.STORE_ASSOCIATE),
  tenantId: z.string().uuid().optional(), // для Super Admin создания
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});
3.2. Auth Service (src/services/auth.service.ts)
TypeScript
Copy
class AuthService {
  async register(data: RegisterInput): Promise<User> {
    // 1. Проверить уникальность email в tenant
    // 2. bcrypt.hash(password, 12)
    // 3. Создать User через Prisma
    // 4. Вернуть user (без passwordHash)
  }

  async login(email: string, password: string, tenantId: string): Promise<TokenPair> {
    // 1. Найти user по email + tenantId
    // 2. bcrypt.compare(password, hash)
    // 3. Генерировать accessToken (15 min) + refreshToken (7 days)
    // 4. Сохранить refreshToken хэш в Redis (для revocation)
    // 5. Вернуть TokenPair
  }

  async logout(refreshToken: string): Promise<void> {
    // 1. Декодировать refreshToken
    // 2. Удалить из Redis (blacklist)
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    // 1. Проверить refreshToken (JWT verify)
    // 2. Проверить что не в blacklist (Redis)
    // 3. Сгенерировать новую пару
    // 4. Старый refreshToken → blacklist
    // 5. Вернуть новую пару
  }
}
3.3. JWT Middleware (src/middleware/auth.ts)
TypeScript
Copy
export const authenticate = (req, res, next) => {
  // 1. Извлечь Bearer token из Authorization
  // 2. jwt.verify(token, JWT_SECRET, { issuer, audience, algorithms: ['HS256'] })
  // 3. Проверить type === 'access'
  // 4. req.user = decoded
  // 5. next()
};
3.4. RBAC Middleware (src/middleware/rbac.ts)
TypeScript
Copy
const roleHierarchy = {
  SUPER_ADMIN: 100, TENANT_ADMIN: 90, REGIONAL_MANAGER: 70,
  STORE_MANAGER: 50, STORE_ASSOCIATE: 30, SUPPLIER: 10
};

export const requirePermission = (permission: string) => {
  return (req, res, next) => {
    // 1. Получить userRole из req.user
    // 2. Проверить в permissions matrix
    // 3. Если нет доступа → 403 + audit log
    // 4. next()
  };
};

export const requireRole = (minRole: UserRole) => {
  return (req, res, next) => {
    // 1. Сравнить roleHierarchy
    // 2. Если level < required → 403
  };
};
3.5. Rate Limiting (src/middleware/rateLimit.ts)
TypeScript
Copy
// Redis Lua token bucket для /auth/*
export const authRateLimit = rateLimit('auth'); // 5 attempts / 15 min per IP
3.6. Auth Controller (src/controllers/auth.controller.ts)
POST /auth/register — authRateLimit, validate(registerSchema), register
POST /auth/login — authRateLimit, validate(loginSchema), login
POST /auth/refresh — validate(refreshSchema), refresh
POST /auth/logout — authenticate, logout
3.7. Auth Routes (src/routes/auth.routes.ts)
Этап 4: Мультитенантность и RLS (2–3 часа)
4.1. Tenant Middleware (src/middleware/tenant.ts)
TypeScript
Copy
export const injectTenant = (req, res, next) => {
  // 1. Извлечь X-Tenant-ID из header ИЛИ tenantId из JWT payload
  // 2. Валидировать UUID
  // 3. Установить в AsyncLocalStorage
  // 4. Prisma extension использует это для SET LOCAL
  next();
};
4.2. Prisma Client Extension (src/config/database.ts)
TypeScript
Copy
const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async findMany({ args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId) {
          args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      // Аналогично для findUnique, findFirst, update, delete, count
    }
  }
});
4.3. Super Admin Bypass
TypeScript
Copy
// В middleware: если role === SUPER_ADMIN, установить app.bypass_rls = 'on'
// В RLS policy: OR current_setting('app.bypass_rls', true) = 'on'
Этап 5: Core Business Logic — Product Catalog (2–3 часа)
5.1. Product Service (src/services/product.service.ts)
TypeScript
Copy
class ProductService {
  async create(data: ProductInput, tenantId: string): Promise<Product> {
    // 1. Проверить уникальность SKU в tenant
    // 2. Создать Product
    // 3. Если есть variants — создать ProductVariant (max 5)
    // 4. Создать Inventory записи для каждой location (quantity=0)
    // 5. Audit log
  }

  async list(tenantId: string, cursor?: string, limit: number = 20) {
    // Cursor-based pagination
  }

  async uploadImage(productId: string, file: Buffer, isPrimary: boolean) {
    // Сохранить в S3/local, создать ProductImage
  }
}
5.2. Product Controller + Routes
GET /products — authenticate, injectTenant, listProducts
POST /products — authenticate, injectTenant, requirePermission('products:create'), createProduct
POST /products/:id/images — uploadProductImage
Этап 6: Core Business Logic — Atomic Transfer (3–4 часа)
6.1. Transfer Service (src/services/transfer.service.ts)
TypeScript
Copy
class TransferService {
  async create(data: CreateTransferInput, userId: string, tenantId: string): Promise<TransferOrder> {
    return await prisma.$transaction(async (tx) => {
      // 1. Проверить что source !== destination
      // 2. Для каждого item:
      //    a. SELECT FOR UPDATE inventory at source
      //    b. Проверить available >= quantity
      //    c. Decrement available at source
      //    d. Increment inTransit at source
      // 3. Создать TransferOrder (status: DRAFT)
      // 4. Создать TransferItem для каждого item
      // 5. Если totalValue > 1000 → requiresApproval = true, status = PENDING_APPROVAL
      // 6. Audit log
    }, { isolationLevel: 'Serializable' });
  }

  async approve(transferId: string, approved: boolean, reason: string, userId: string) {
    // 1. Проверить role >= REGIONAL_MANAGER
    // 2. Проверить status === PENDING_APPROVAL
    // 3. Если approved → status = APPROVED
    // 4. Если rejected → status = CANCELLED, вернуть stock
  }

  async ship(transferId: string, carrier: string, trackingNumber: string) {
    // 1. Проверить status === APPROVED
    // 2. status = IN_TRANSIT
    // 3. Записать shippedAt
  }

  async receive(transferId: string, items: ReceiveItemInput[]) {
    // 1. Проверить status === IN_TRANSIT
    // 2. Для каждого item: проверить quantityReceived <= quantityShipped
    // 3. Обновить inventory at destination (increment available)
    // 4. Обновить inventory at source (decrement inTransit)
    // 5. Если все получены → status = COMPLETED
    // 6. Если частично → status = PARTIALLY_RECEIVED
  }
}
6.2. Transfer Controller + Routes
POST /transfers — authenticate, injectTenant, requirePermission('transfers:create')
POST /transfers/:id/approve — authenticate, injectTenant, requirePermission('transfers:approve')
POST /transfers/:id/ship — authenticate, injectTenant
POST /transfers/:id/receive — authenticate, injectTenant
Этап 7: Core Business Logic — Dead Stock Cron (2–3 часа)
7.1. Dead Stock Service (src/services/deadStock.service.ts)
TypeScript
Copy
class DeadStockService {
  async applyDiscounts(tenantId: string): Promise<number> {
    // 1. Найти inventory с daysInInventory > 30
    // 2. Определить tier по дням
    // 3. Рассчитать newPrice = max(oldPrice * (1 - discount), baseCost * 1.1)
    // 4. Обновить retailPrice в Product
    // 5. Создать PriceHistory запись
    // 6. Создать Notification для менеджеров
    // 7. Вернуть количество обновленных
  }
}
7.2. BullMQ Job (src/jobs/deadStock.job.ts)
TypeScript
Copy
// Запускать ежедневно в 2:00 AM
// Для КАЖДОГО активного tenant:
//   1. Установить tenant context
//   2. Вызвать deadStockService.applyDiscounts(tenantId)
//   3. Логировать результат
7.3. Или pg_cron fallback (если выбран) — использовать dead_stock_cron_wrapper() из fixed schema
Этап 8: Swagger UI и API Docs (1 час)
8.1. src/app.ts
TypeScript
Copy
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const swaggerDocument = YAML.load('./docs/openapi.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
8.2. Убедиться что все endpoints из 04-openapi-fixed.yaml реализованы или помечены как Not Implemented
Этап 9: Тестирование (3–4 часа)
9.1. Unit Tests (tests/unit/)
TypeScript
Copy
// auth.service.test.ts
describe('AuthService', () => {
  test('register creates user with hashed password');
  test('login returns tokens for valid credentials');
  test('login rejects invalid password');
  test('refresh rejects blacklisted token');
});

// deadStock.service.test.ts
describe('DeadStockService', () => {
  test('applyDiscounts calculates correct tier');
  test('applyDiscounts respects cost + 10% floor');
});
9.2. Integration Tests (tests/integration/)
TypeScript
Copy
// auth.test.ts
describe('Auth API', () => {
  test('POST /auth/register creates user');
  test('POST /auth/login returns 429 after 5 attempts');
  test('GET /products without token returns 401');
  test('GET /products with wrong role returns 403');
});

// transfer.test.ts
describe('Transfer API', () => {
  test('POST /transfers creates transfer with SELECT FOR UPDATE');
  test('transfer prevents overselling (409 Conflict)');
  test('transfer > $1000 requires approval');
});
9.3. Test Setup (tests/setup.ts)
TypeScript
Copy
// 1. Поднять test database (Docker)
// 2. Run migrations
// 3. Seed test data
// 4. After all: truncate tables
Этап 10: CI/CD и финализация (1–2 часа)
10.1. .github/workflows/ci.yml
yaml
Copy
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: leanstock_test
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      - run: docker build .
10.2. README.md
Setup instructions
Architecture decisions
docker compose up command
Test command
API docs URL
10.3. CHANGELOG.md — если есть отклонения от blueprint