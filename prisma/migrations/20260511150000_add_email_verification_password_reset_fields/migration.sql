-- Migration: Add email verification and password reset fields to users table
-- Created: 2026-05-11

-- Add email verification fields
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT,
ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT,
ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP(3);

-- Create unique indexes for verification tokens
CREATE UNIQUE INDEX IF NOT EXISTS "users_emailVerificationToken_key" ON "users"("emailVerificationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "users_passwordResetToken_key" ON "users"("passwordResetToken");

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "users_emailVerificationToken_idx" ON "users"("emailVerificationToken");
CREATE INDEX IF NOT EXISTS "users_passwordResetToken_idx" ON "users"("passwordResetToken");

-- Comment explaining the migration
COMMENT ON COLUMN "users"."emailVerified" IS 'Whether user email has been verified';
COMMENT ON COLUMN "users"."emailVerificationToken" IS 'Token for email verification (unique)';
COMMENT ON COLUMN "users"."emailVerificationExpires" IS 'Expiration time for email verification token';
COMMENT ON COLUMN "users"."passwordResetToken" IS 'Token for password reset (unique)';
COMMENT ON COLUMN "users"."passwordResetExpires" IS 'Expiration time for password reset token';
