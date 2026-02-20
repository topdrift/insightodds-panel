-- CreateEnum
CREATE TYPE "PromoCodeType" AS ENUM ('BALANCE_CREDIT', 'REFERRAL_BONUS');

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PromoCodeType" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "agentId" TEXT,
    "agentBonus" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "clientBonus" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "minRole" "Role" NOT NULL DEFAULT 'CLIENT',
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_code_idx" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_type_idx" ON "PromoCode"("type");

-- CreateIndex
CREATE INDEX "PromoCode_isActive_idx" ON "PromoCode"("isActive");

-- CreateIndex
CREATE INDEX "PromoRedemption_promoCodeId_idx" ON "PromoRedemption"("promoCodeId");

-- CreateIndex
CREATE INDEX "PromoRedemption_userId_idx" ON "PromoRedemption"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoRedemption_promoCodeId_userId_key" ON "PromoRedemption"("promoCodeId", "userId");

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
