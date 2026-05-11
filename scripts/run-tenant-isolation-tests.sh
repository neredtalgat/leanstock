#!/bin/bash

# Tenant Isolation Integration Tests Runner
# This script sets up a test database and runs tenant isolation tests

set -e

echo "🔒 Running Tenant Isolation Integration Tests..."

# Set test environment
export NODE_ENV=test
export DATABASE_URL="postgresql://test:test@localhost:5432/leanstock_test"
export REDIS_URL="redis://localhost:6379/1"

# Create test database if it doesn't exist
echo "📊 Setting up test database..."
psql -U postgres -h localhost -p 5432 -c "DROP DATABASE IF EXISTS leanstock_test;" || true
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE leanstock_test;" || true

# Run migrations on test database
echo "🔄 Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run tenant isolation tests
echo "🧪 Running tenant isolation tests..."
npm test -- tests/integration/tenant-isolation.test.ts

# Cleanup test database
echo "🧹 Cleaning up test database..."
psql -U postgres -h localhost -p 5432 -c "DROP DATABASE IF EXISTS leanstock_test;" || true

echo "✅ Tenant Isolation Tests Completed!"
