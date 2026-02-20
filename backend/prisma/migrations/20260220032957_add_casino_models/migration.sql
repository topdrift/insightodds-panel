-- CreateEnum
CREATE TYPE "CasinoGameType" AS ENUM ('AVIATOR', 'BLACKJACK');

-- CreateEnum
CREATE TYPE "CasinoRoundStatus" AS ENUM ('BETTING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CasinoBetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'CASHED_OUT', 'CANCELLED');

-- CreateTable
CREATE TABLE "CasinoGame" (
    "id" TEXT NOT NULL,
    "gameType" "CasinoGameType" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minBet" DECIMAL(18,2) NOT NULL DEFAULT 10,
    "maxBet" DECIMAL(18,2) NOT NULL DEFAULT 100000,
    "houseEdge" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasinoGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasinoRound" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "CasinoRoundStatus" NOT NULL DEFAULT 'BETTING',
    "crashPoint" DECIMAL(10,2),
    "serverSeed" TEXT,
    "hashChain" TEXT,
    "dealerCards" JSONB,
    "dealerScore" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CasinoRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasinoBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "cashOutMultiplier" DECIMAL(10,2),
    "playerCards" JSONB,
    "playerScore" INTEGER,
    "actions" JSONB,
    "profitLoss" DECIMAL(18,2),
    "status" "CasinoBetStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasinoBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CasinoGame_gameType_key" ON "CasinoGame"("gameType");

-- CreateIndex
CREATE INDEX "CasinoRound_gameId_idx" ON "CasinoRound"("gameId");

-- CreateIndex
CREATE INDEX "CasinoRound_status_idx" ON "CasinoRound"("status");

-- CreateIndex
CREATE INDEX "CasinoRound_roundNumber_idx" ON "CasinoRound"("roundNumber");

-- CreateIndex
CREATE INDEX "CasinoBet_userId_idx" ON "CasinoBet"("userId");

-- CreateIndex
CREATE INDEX "CasinoBet_roundId_idx" ON "CasinoBet"("roundId");

-- CreateIndex
CREATE INDEX "CasinoBet_status_idx" ON "CasinoBet"("status");

-- AddForeignKey
ALTER TABLE "CasinoRound" ADD CONSTRAINT "CasinoRound_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CasinoGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasinoBet" ADD CONSTRAINT "CasinoBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasinoBet" ADD CONSTRAINT "CasinoBet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CasinoRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
