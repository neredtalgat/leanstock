-- AlterTable
ALTER TABLE "dead_stock_rules" ADD COLUMN     "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "tenants" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "transfer_orders_createdBy_idx" ON "transfer_orders"("createdBy");

-- CreateIndex
CREATE INDEX "transfer_orders_approvedBy_idx" ON "transfer_orders"("approvedBy");

-- CreateIndex
CREATE INDEX "transfer_orders_status_idx" ON "transfer_orders"("status");

-- CreateIndex
CREATE INDEX "users_emailVerificationToken_idx" ON "users"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "users_passwordResetToken_idx" ON "users"("passwordResetToken");
