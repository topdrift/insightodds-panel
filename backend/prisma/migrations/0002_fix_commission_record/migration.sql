-- DropForeignKey
ALTER TABLE "CommissionRecord" DROP CONSTRAINT IF EXISTS "CommissionRecord_betId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "CommissionRecord_betId_key";

-- CreateIndex
CREATE INDEX "CommissionRecord_betId_idx" ON "CommissionRecord"("betId");
