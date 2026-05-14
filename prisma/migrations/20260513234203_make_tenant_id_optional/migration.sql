-- AlterTable: Make tenantId nullable in users table
ALTER TABLE "users" ALTER COLUMN "tenantId" DROP NOT NULL;

-- Update the unique constraint to handle NULL values properly
-- Note: PostgreSQL allows multiple NULL values in unique constraints
-- So we don't need to drop and recreate the constraint
