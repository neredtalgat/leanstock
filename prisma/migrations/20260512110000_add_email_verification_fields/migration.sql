-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_emailVerificationToken_key" ON "users"("emailVerificationToken");

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_passwordResetToken_key" ON "users"("passwordResetToken");

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
