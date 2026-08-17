-- AlterTable
ALTER TABLE "GiftCode" ADD COLUMN "purchaseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GiftCode_purchaseId_key" ON "GiftCode"("purchaseId");
