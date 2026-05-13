#!/bin/sh
set -e

echo "=== LeanStock Container Startup ==="

# Check if migrations folder exists
echo "Checking migrations..."
ls -la prisma/migrations/

# Wait for database
echo "Waiting for database at postgres:5432..."
until nc -z postgres 5432; do
  echo "Waiting for postgres..."
  sleep 1
done
echo "Database is ready!"

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

echo "Migrations completed successfully!"

# Seed database (optional, runs if SEED_DATABASE is set)
if [ "$SEED_DATABASE" = "true" ]; then
  echo "Seeding database..."
  npx ts-node prisma/seed.ts || echo "Seed completed with warnings"
fi

echo "Starting application..."
exec npm start
