# LeanStock - Intelligent Inventory Management System

A modern, enterprise-grade inventory management system built with TypeScript, Express, Prisma, and PostgreSQL. Designed for multi-tenant SaaS environments with advanced features like dead stock detection, demand forecasting, and comprehensive audit logging.

## 🎯 Features

### Core Capabilities
- **Multi-Tenant Architecture** - Complete data isolation with Row-Level Security (RLS)
- **Authentication & Authorization** - JWT-based auth with role-based access control (RBAC)
- **Product Management** - SKU tracking, barcode support, product variants
- **Inventory Tracking** - Real-time inventory levels, bin locations, movement history
- **Demand Forecasting** - Historical demand tracking and analysis
- **Dead Stock Detection** - Automated rules to identify slow-moving inventory
- **Purchase Order Management** - Supplier integration and PO tracking
- **Transfer Orders** - Inter-location inventory transfers
- **Audit Logging** - Complete activity tracking for compliance

### Technical Features
- Rate limiting and request throttling
- Comprehensive error handling
- Request validation with Zod
- Database migrations with Prisma
- Redis caching and session management
- Docker support with docker-compose
- CI/CD pipeline ready
- Unit and integration tests

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- npm or yarn

## 🚀 Quick Start

### 1. Clone & Install

```bash
cd leanstock
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Update `.env` with your local configuration:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://leanstock:password@localhost:5432/leanstock
REDIS_URL=redis://localhost:6379

JWT_SECRET=your_super_secret_jwt_key_min_32_characters_required_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_ROUNDS=12
LOG_LEVEL=info
```

### 3. Database Setup

Using Docker:
```bash
docker-compose up -d
```

Running migrations:
```bash
npm run migrate
```

Seeding test data:
```bash
npm run seed
```

### 4. Start Development Server

```bash
npm run dev
```

Server will be running at `http://localhost:3000`
API documentation is available at `http://localhost:3000/api-docs`

## 📚 Project Structure

```
leanstock/
├── src/
│   ├── config/          # Environment, database, Redis, logger
│   ├── middleware/      # Authentication, validation, error handling
│   ├── schemas/         # Zod validation schemas
│   ├── services/        # Business logic
│   ├── controllers/     # HTTP request handlers
│   ├── routes/          # API route definitions
│   ├── utils/           # Helpers and utilities
│   ├── types/           # TypeScript type definitions
│   ├── app.ts           # Express app configuration
│   └── server.ts        # Entry point
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── seed.ts          # Database seeding
│   └── migrations/      # Database migrations
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── setup.ts         # Test utilities
├── docs/                # API documentation
├── docker-compose.yml   # Docker Compose configuration
├── Dockerfile           # Docker image configuration
└── package.json         # Dependencies & scripts
```

## 🔌 API Endpoints

### Authentication

**Register**
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!",
  "firstName": "John",
  "lastName": "Doe",
  "tenantId": "tenant-uuid"
}
```

**Login**
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!",
  "tenantId": "tenant-uuid"
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": "15m"
  }
}
```

**Refresh Token**
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

**Logout**
```http
POST /auth/logout
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

### Products

**Create Product**
```http
POST /products
Authorization: Bearer {accessToken}
X-Tenant-ID: {tenantId}
Content-Type: application/json

{
  "name": "Laptop",
  "sku": "LAPTOP-001",
  "price": 999.99,
  "costPrice": 500.00,
  "category": "Electronics",
  "reorderPoint": 5
}
```

**List Products**
```http
GET /products?limit=20&cursor=null&search=&status=ACTIVE
Authorization: Bearer {accessToken}
X-Tenant-ID: {tenantId}
```

**Get Product**
```http
GET /products/{productId}
Authorization: Bearer {accessToken}
X-Tenant-ID: {tenantId}
```

**Update Product**
```http
PATCH /products/{productId}
Authorization: Bearer {accessToken}
X-Tenant-ID: {tenantId}
Content-Type: application/json

{
  "price": 899.99,
  "status": "ACTIVE"
}
```

**Delete Product**
```http
DELETE /products/{productId}
Authorization: Bearer {accessToken}
X-Tenant-ID: {tenantId}
```

## 🔐 Role-Based Access Control

### Roles & Permissions

| Role | Level | Permissions |
|------|-------|-------------|
| SUPER_ADMIN | 100 | All (*) |
| TENANT_ADMIN | 90 | Products, Inventory, Users, Reports |
| REGIONAL_MANAGER | 70 | Products (read), Inventory, Reports |
| STORE_MANAGER | 50 | Products (read), Inventory |
| STORE_ASSOCIATE | 30 | Products (read), Inventory (read) |
| SUPPLIER | 10 | Products (read), Reports (read) |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Generate coverage report
npm test:coverage
```

## 📦 Scripts

```bash
npm run dev           # Start development server
npm run build         # Build TypeScript
npm start             # Start production server
npm test              # Run tests
npm lint              # Lint code
npm lint:fix          # Fix linting issues
npm run migrate       # Run database migrations
npm run seed          # Seed database with test data
npm run reset         # Reset database
```

## 🐳 Docker

### Build & Run

```bash
docker-compose up --build
```

### Logs

```bash
docker-compose logs -f app
```

### Stop

```bash
docker-compose down
```

## 📝 Environment Variables

See `.env.example` for all available variables:

- `NODE_ENV` - Environment (development/production/test)
- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret (min 32 chars)
- `JWT_EXPIRES_IN` - Access token expiry (default: 15m)
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiry (default: 7d)
- `BCRYPT_ROUNDS` - Password hashing rounds (default: 12)
- `LOG_LEVEL` - Logging level (default: info)

## 🏗️ Architecture

### Multi-Tenancy

Data isolation is enforced at multiple levels:
- Database schema with `tenantId` on all relevant tables
- Prisma Client extension for automatic tenant filtering
- Row-Level Security (RLS) policies on PostgreSQL
- Super Admin bypass capability

### Authentication Flow

1. User registers/logs in
2. Service validates credentials
3. JWT tokens generated (access + refresh)
4. Refresh token stored in Redis for revocation
5. Subsequent requests validated via JWT middleware
6. Tenant context automatically injected via AsyncLocalStorage

### Data Access

- RBAC middleware checks permissions before each request
- Tenant context injected for multi-tenant isolation
- Automatic where-clause injection via Prisma extension
- Audit logging for all modifications

## 🔄 Development Workflow

1. Create feature branch
2. Make changes
3. Run linting: `npm lint:fix`
4. Run tests: `npm test`
5. Submit PR

## 📄 License

Proprietary - All rights reserved

## 🤝 Support

For issues and questions, please contact the development team.

---

**Built with ❤️ for efficient inventory management**
