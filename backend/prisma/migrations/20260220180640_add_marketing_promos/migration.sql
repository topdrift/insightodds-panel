-- AlterEnum
ALTER TYPE "PromoCodeType" ADD VALUE 'MARKETING';

-- AlterTable
ALTER TABLE "PromoCode" ADD COLUMN     "marketingSpreadHrs" INTEGER,
ADD COLUMN     "marketingTarget" TEXT,
ADD COLUMN     "marketingWinAmount" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "WhitelabelConfig" ALTER COLUMN "siteName" SET DEFAULT 'InsightOdds';

-- CreateTable
CREATE TABLE "MarketingBetJob" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "betId" TEXT,
    "betType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingBetJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingBetJob_status_scheduledAt_idx" ON "MarketingBetJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "MarketingBetJob_userId_idx" ON "MarketingBetJob"("userId");

-- AddForeignKey
ALTER TABLE "MarketingBetJob" ADD CONSTRAINT "MarketingBetJob_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingBetJob" ADD CONSTRAINT "MarketingBetJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
