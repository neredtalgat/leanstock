# 🚀 LeanStock Quick Start Guide

## First Time Setup (5-10 minutes)

### 1. Prerequisites Check
```bash
node --version  # Should be 18+
npm --version   # Should be 8+
docker --version  # Optional, for database
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup

**Option A: Using Docker** (Recommended)
```bash
docker-compose up -d
```

**Option B: Manual Setup**
- Install PostgreSQL 15 and start it
- Create database: `createdb leanstock`
- Update `DATABASE_URL` in `.env`
- Install Redis 7 and start it
- Update `REDIS_URL` in `.env`

### 4. Initialize Database
```bash
npm run migrate    # Run migrations
npm run seed       # Load test data
```

### 5. Start Development Server
```bash
npm run dev
```

Server running at: `http://localhost:3000`

---

## 🧪 Test the API

### Health Check
```bash
curl http://localhost:3000/health
```

### Register User
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!",
    "tenantId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Password123!",
    "tenantId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

**Output** (copy the accessToken):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "15m"
  }
}
```

### Create Product (using the accessToken)
```bash
curl -X POST http://localhost:3000/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "sku": "TEST-001",
    "price": 99.99,
    "costPrice": 50.00,
    "category": "Electronics"
  }'
```

### List Products
```bash
curl http://localhost:3000/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

---

## 📊 Use Seeded Test Data

The seed creates:
- **Tenant**: Test Tenant (id: see database)
- **Admin User**: admin@example.com / Password123!
- **Manager User**: manager@example.com / Password123!
- **Locations**: Main Warehouse, Store 1
- **Products**: Laptop, Mouse
- **Inventory**: Pre-populated with quantities

### Authenticate with Test Data:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Password123!",
    "tenantId": "TENANT_ID_FROM_DATABASE"
  }'
```

Get tenant ID from database:
```bash
docker exec leanstock-postgres psql -U leanstock -d leanstock -c "SELECT id, name FROM \"Tenant\";"
```

---

## 🛠️ Useful Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Compile TypeScript to JavaScript
npm start                # Run production server

# Database
npm run migrate          # Run pending migrations
npm run seed             # Seed test data
npm run reset            # Reset entire database
npx prisma studio       # Open Prisma Studio (GUI)

# Testing
npm test                 # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report

# Code Quality
npm run lint             # Check code style
npm run lint:fix         # Fix code style issues
npm run build            # Type-check TypeScript

# Docker
docker-compose up       # Start all services
docker-compose down     # Stop all services
docker-compose logs -f  # View logs
```

---

## 📚 API Documentation

See `docs/API.md` for:
- Complete endpoint reference
- Request/response examples
- Error codes
- Role-based permissions
- Rate limiting info

---

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Change port in .env
PORT=3001

# Or kill the process
lsof -i :3000
kill -9 <PID>
```

### Database Connection Error
```bash
# Check DATABASE_URL in .env
# Ensure PostgreSQL is running
# Test connection:
psql postgresql://leanstock:password@localhost:5432/leanstock
```

### Redis Connection Error
```bash
# Ensure Redis is running
# Check REDIS_URL in .env
redis-cli ping  # Should return PONG
```

### Migration Errors
```bash
# Reset migrations
npm run reset
npm run migrate
npm run seed
```

---

## 🚀 Deploy to Production

### Build Docker Image
```bash
docker build -t leanstock:latest .
```

### Run Container
```bash
docker run \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e JWT_SECRET="your-secret-key" \
  -p 3000:3000 \
  leanstock:latest
```

### Or use Docker Compose
```bash
docker-compose -f docker-compose.yml up -d
```

---

## 📝 Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Min 32 characters

**Optional:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production/test)
- `LOG_LEVEL` - Logging level (default: info)
- `BCRYPT_ROUNDS` - Password hash rounds (default: 12)

See `.env.example` for all variables.

---

## 🆘 Need Help?

1. Check `README.md` for detailed documentation
2. Review `docs/API.md` for API reference
3. See `IMPLEMENTATION.md` for project structure
4. Check logs with `docker-compose logs -f app`
5. View database with `npx prisma studio`

---

**Ready to code! 🎉**
