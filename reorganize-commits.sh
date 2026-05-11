#!/bin/bash
# Run this script to reorganize commits into 4 logical layers
# WARNING: This uses git reset --soft, ensure you have a backup branch

set -e

echo "=== Creating backup branch ==="
git branch backup-original-main

echo "=== Resetting to initial state (keeping changes staged) ==="
git reset --soft $(git rev-list --max-parents=0 HEAD)

# Commit 1: chore: project bootstrap and docker setup
echo "=== Commit 1: Project Bootstrap ==="
git reset HEAD
git add package.json tsconfig.json docker-compose.yml Dockerfile .env.example .gitignore jest.config.js
mkdir -p src/config
git add src/config/logger.ts src/config/redis.ts 2>/dev/null || true
git commit -m "chore: project bootstrap and docker setup

- Add package.json with all dependencies
- Configure TypeScript (tsconfig.json)
- Setup Docker environment (docker-compose, Dockerfile)
- Add environment configuration (.env.example)
- Configure Jest for testing
- Add core config files (logger, redis)"

# Commit 2: feat: prisma schema with RLS and constraints
echo "=== Commit 2: Prisma Schema ==="
git add prisma/schema.prisma prisma/migrations/ src/config/database.ts prisma/seed.ts
git commit -m "feat: prisma schema with RLS and constraints

- Define complete data model with multi-tenancy
- Add Row Level Security (RLS) policies
- Setup AsyncLocalStorage for tenant context
- Add database indexes for performance
- Create seed script for test data"

# Commit 3: feat: complete authentication and authorization
echo "=== Commit 3: Auth System ==="
git add src/schemas/auth.schema.ts src/services/auth.service.ts \
    src/controllers/auth.controller.ts src/routes/auth.routes.ts \
    src/middleware/auth.ts src/middleware/rbac.ts \
    src/middleware/rateLimit.ts src/middleware/tenant.ts \
    src/middleware/errorHandler.ts src/middleware/validate.ts \
    src/types/index.ts src/app.ts
git commit -m "feat: complete authentication and authorization

- JWT-based authentication with access/refresh tokens
- Role-based access control (RBAC) middleware
- Multi-tenancy with tenant isolation
- Rate limiting with Redis token bucket
- Comprehensive error handling middleware
- Zod validation for all inputs"

# Commit 4: test: integration tests and CI pipeline
echo "=== Commit 4: Tests & CI ==="
git add tests/ .github/workflows/ci.yml README.md docs/openapi.yaml \
    src/services/product.service.ts src/controllers/product.controller.ts \
    src/routes/product.routes.ts src/schemas/product.schema.ts \
    src/jobs/ src/utils/ context.md
git commit -m "test: integration tests and CI pipeline

- Add integration tests for auth API
- Setup Jest test configuration
- Configure GitHub Actions CI workflow
- Add OpenAPI documentation
- Implement Product Catalog (Stage 5)
- Add background jobs (reorderCheck, deadStock)
- Add utility helpers
- Complete project documentation"

echo "=== Done! 4 commits created ==="
git log --oneline -5
