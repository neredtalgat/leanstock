# LeanStock

Multi-tenant inventory management system with atomic transfers, dead stock decay, and RBAC.

## Architecture

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis (caching, rate limiting, BullMQ jobs)
- **Auth**: JWT (access + refresh tokens) with Redis blacklist
- **Multi-tenancy**: Tenant isolation via AsyncLocalStorage + Prisma extensions
- **RBAC**: Role-based access control with permissions matrix
- **Background Jobs**: BullMQ for reorder checks and dead stock discounts

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

## API Documentation

Swagger UI available at: `http://localhost:3000/api-docs`

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

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

## CI/CD

GitHub Actions workflow runs on every push:
- Install dependencies
- Run linter
- Run tests
- Build project
- Docker build

## License

ISC