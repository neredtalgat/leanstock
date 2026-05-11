# LeanStock

Production-grade multi-tenant inventory management system with atomic transfers, dead stock decay, and RBAC.

## 🏗️ Architecture

### Core Technology Stack
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis (caching, rate limiting, BullMQ jobs)
- **Auth**: JWT (access + refresh tokens) with Redis blacklist
- **Multi-tenancy**: Tenant isolation via AsyncLocalStorage + Prisma extensions
- **RBAC**: Role-based access control with permissions matrix
- **Background Jobs**: BullMQ for reorder checks and dead stock discounts

### Architecture Decisions
- **Type Safety**: Full TypeScript implementation with strict mode
- **Database First**: Prisma schema-driven development with migrations
- **Event-Driven**: Background workers for async operations (email, inventory checks)
- **Security First**: JWT with refresh rotation, rate limiting, input validation
- **Multi-Tenant**: Complete data isolation at database level
- **API First**: RESTful design with OpenAPI 3.0.0 specification

## Tech Stack

- **Express** - Web framework
- **Prisma** - ORM with type-safe queries
- **PostgreSQL** - Primary database
- **Redis** - Caching, rate limiting, job queue
- **BullMQ** - Background job processing
- **Zod** - Schema validation
- **Pino** - Structured logging
- **Swagger UI** - API documentation

## Setup

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Clone repository
git clone https://github.com/neredtalgat/leanstock.git
cd leanstock

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npm run seed
```

### Start Services

```bash
# Option 1: Docker Compose (recommended)
docker-compose up

# Option 2: Local development
npm run dev
```

## 📚 API Documentation

### OpenAPI Specification
- **File**: `openapi.yaml` (complete OpenAPI 3.0.0 specification)
- **Swagger UI**: `http://localhost:3001/api-docs`
- **Postman Collection**: `leanstock-complete-postman-collection.json`

### Coverage
- **68 endpoints** fully documented
- **All schemas** with examples
- **Authentication flows** with JWT
- **Error responses** standardized
- **Pagination** implemented consistently

## 🧪 Testing

### Test Structure
- **Unit Tests**: Business logic, services, utilities
- **Integration Tests**: API endpoints, database operations
- **E2E Tests**: Complete workflows (transfers, purchases)

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage

# Run specific test suites
npm run test:unit     # Unit tests only
npm run test:integration # Integration tests only
```

### Test Coverage
- **Authentication**: JWT flows, email verification, password reset
- **Business Logic**: Inventory transfers, purchase orders, supplier returns
- **Multi-tenant**: Tenant isolation and data security
- **API Endpoints**: All 68 endpoints tested

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | - |
| `JWT_EXPIRES_IN` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` |
| `LOG_LEVEL` | Logging level | `info` |
| `CORS_ORIGIN` | CORS allowed origin | `*` |

## Project Structure

```
src/
├── config/          # Configuration (env, database, redis, logger)
├── middleware/      # Express middleware (auth, rbac, rateLimit, tenant)
├── routes/          # API route definitions
├── controllers/     # Request handlers
├── services/        # Business logic
├── schemas/         # Zod validation schemas
├── jobs/            # Background jobs (BullMQ)
├── utils/           # Helper functions
├── types/           # TypeScript type definitions
├── app.ts           # Express app setup
└── server.ts        # Server startup
```

## Features

### Authentication & Authorization
- User registration with email validation
- JWT-based authentication (access + refresh tokens)
- Token refresh with revocation (Redis blacklist)
- Role-based access control (Admin, Manager, Associate)
- Rate limiting on auth endpoints

### Multi-tenancy
- Tenant isolation at database level
- AsyncLocalStorage for tenant context
- Automatic tenant filtering in queries

### Product Catalog
- Multi-tenant product CRUD
- Cursor-based pagination
- Image upload support
- Variant management

### Inventory Management
- Real-time stock tracking
- Location-based inventory
- Reserved quantity tracking
- In-transit tracking

### Transfer Orders
- Atomic transfers between locations (SELECT FOR UPDATE)
- Approval workflow for high-value transfers
- Shipping and receiving workflow
- Partial receiving support

### Dead Stock Management
- Automatic discount application based on days in inventory
- Tiered discount structure (10%, 20%, 30%)
- Price floor enforcement (baseCost * 1.1)
- Price history tracking
- Manager notifications

## Development

```bash
# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build

# Start production server
npm start
```

## 🚀 Deployment

### Production Deployment
```bash
# Build application
npm run build

# Set production environment
export NODE_ENV=production

# Start production server
npm start
```

### Docker Deployment
```bash
# Build Docker image
docker build -t leanstock .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

### Environment Setup
- **Database**: PostgreSQL 15+ required
- **Redis**: Redis 7+ required  
- **Node.js**: 18+ LTS recommended
- **Memory**: Minimum 2GB RAM
- **Storage**: Minimum 10GB available

### CI/CD

GitHub Actions workflow runs on every push:
- Install dependencies
- Run linter
- Run tests with coverage
- Build project
- Docker build and security scan

### Production Considerations
- **Graceful Shutdown**: SIGTERM/SIGINT handling
- **Health Checks**: `/health` endpoint for load balancers
- **Logging**: Structured JSON logs with correlation IDs
- **Security**: Helmet.js, rate limiting, CORS configuration
- **Monitoring**: Ready for APM integration

## 📜 License

ISC