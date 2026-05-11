-- AlterTable
ALTER TABLE "tenants" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "transfer_orders_createdBy_idx" ON "transfer_orders"("createdBy");

-- CreateIndex
CREATE INDEX "transfer_orders_approvedBy_idx" ON "transfer_orders"("approvedBy");

-- CreateIndex
CREATE INDEX "transfer_orders_status_idx" ON "transfer_orders"("status");
