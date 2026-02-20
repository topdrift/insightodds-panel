-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'AGENT', 'CLIENT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'CHIPS', 'FREE_CHIPS', 'PROFIT', 'LOSS', 'SETTLEMENT', 'GAME_REPORT', 'BALANCE_REPORT', 'LIABILITY', 'ROLL_BACK', 'COMMISSION', 'BET_PLACED', 'BET_WON', 'BET_LOST', 'BET_VOID');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'DELETED');

-- CreateEnum
CREATE TYPE "BetType" AS ENUM ('BACK', 'LAY');

-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('CRICKET', 'SOCCER', 'TENNIS', 'CASINO', 'MATKA');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('ODI', 'T20', 'TEST');

-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('MATCH_ODDS', 'BOOKMAKER', 'FANCY');

-- CreateEnum
CREATE TYPE "MatkaBetType" AS ENUM ('ANDAR_DHAI', 'BAHAR_HARUF', 'JODI');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('LOGIN', 'CHANGE_PASSWORD');

-- CreateEnum
CREATE TYPE "LimitType" AS ENUM ('CREDIT_REFERENCE', 'EXPOSURE_LIMIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "transactionPassword" TEXT,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "reference" TEXT,
    "role" "Role" NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "exposure" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditReference" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "exposureLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "myPartnership" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "myCasinoPartnership" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "myMatkaPartnership" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "matchCommission" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sessionCommission" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "casinoCommission" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "matkaCommission" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBetLocked" BOOLEAN NOT NULL DEFAULT false,
    "isCasinoLocked" BOOLEAN NOT NULL DEFAULT false,
    "isMatkaLocked" BOOLEAN NOT NULL DEFAULT false,
    "resetPasswordRequired" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "reference" TEXT,
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CricketEvent" (
    "id" TEXT NOT NULL,
    "cricketId" INTEGER NOT NULL,
    "gameId" TEXT,
    "eventId" TEXT,
    "marketId" TEXT,
    "eventName" TEXT NOT NULL,
    "team1" TEXT NOT NULL,
    "team2" TEXT NOT NULL,
    "matchType" "MatchType" NOT NULL DEFAULT 'T20',
    "competition" TEXT,
    "startTime" TIMESTAMP(3),
    "inPlay" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "isBetLocked" BOOLEAN NOT NULL DEFAULT false,
    "isFancyLocked" BOOLEAN NOT NULL DEFAULT false,
    "minBet" DECIMAL(18,2) NOT NULL DEFAULT 100,
    "maxBet" DECIMAL(18,2) NOT NULL DEFAULT 500000,
    "oddsDifference" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "matchOddsData" JSONB,
    "bookmakerData" JSONB,
    "fancyOddsData" JSONB,
    "scoreData" JSONB,
    "betLockedUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fancyLockedUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "winner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CricketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "cricketEventId" TEXT NOT NULL,
    "externalMarketId" TEXT NOT NULL,
    "marketName" TEXT NOT NULL,
    "marketType" "MarketType" NOT NULL,
    "gameType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBetLocked" BOOLEAN NOT NULL DEFAULT false,
    "minBet" DECIMAL(18,2) NOT NULL DEFAULT 100,
    "maxBet" DECIMAL(18,2) NOT NULL DEFAULT 500000,
    "result" TEXT,
    "finalScore" INTEGER,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cricketEventId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "selectionId" INTEGER NOT NULL,
    "runnerName" TEXT NOT NULL,
    "marketName" TEXT,
    "betType" "BetType" NOT NULL,
    "sport" "Sport" NOT NULL DEFAULT 'CRICKET',
    "amount" DECIMAL(18,2) NOT NULL,
    "rate" DECIMAL(10,4) NOT NULL,
    "back" DECIMAL(10,4),
    "backRate" DECIMAL(10,4),
    "lay" DECIMAL(10,4),
    "layRate" DECIMAL(10,4),
    "profit" DECIMAL(18,2) NOT NULL,
    "loss" DECIMAL(18,2) NOT NULL,
    "profitLoss" DECIMAL(18,2),
    "betStatus" "BetStatus" NOT NULL DEFAULT 'MATCHED',
    "isMatched" BOOLEAN NOT NULL DEFAULT true,
    "result" TEXT,
    "ip" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FancyBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cricketEventId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "marketName" TEXT,
    "runnerName" TEXT,
    "gameType" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "oddsBack" DECIMAL(10,4),
    "oddsLay" DECIMAL(10,4),
    "backRate" DECIMAL(10,4),
    "layRate" DECIMAL(10,4),
    "profit" DECIMAL(18,2) NOT NULL,
    "loss" DECIMAL(18,2) NOT NULL,
    "profitLoss" DECIMAL(18,2),
    "betStatus" "BetStatus" NOT NULL DEFAULT 'MATCHED',
    "result" TEXT,
    "ip" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FancyBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matka" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "resultTime" TEXT NOT NULL,
    "minStack" DECIMAL(18,2) NOT NULL DEFAULT 10,
    "maxStack" DECIMAL(18,2) NOT NULL DEFAULT 50000,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatkaMarket" (
    "id" TEXT NOT NULL,
    "matkaId" TEXT NOT NULL,
    "dateId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isMarketSettled" BOOLEAN NOT NULL DEFAULT false,
    "result" INTEGER,
    "minStack" DECIMAL(18,2) NOT NULL DEFAULT 10,
    "maxStack" DECIMAL(18,2) NOT NULL DEFAULT 50000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatkaMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatkaBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matkaMarketId" TEXT NOT NULL,
    "betType" "MatkaBetType" NOT NULL,
    "numbers" JSONB NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "profitLoss" DECIMAL(18,2),
    "betStatus" "BetStatus" NOT NULL DEFAULT 'MATCHED',
    "isWinning" BOOLEAN NOT NULL DEFAULT false,
    "result" INTEGER,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatkaBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "sport" "Sport" NOT NULL DEFAULT 'CRICKET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "announcement" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardBanner" (
    "id" TEXT NOT NULL,
    "bannerUrl" TEXT NOT NULL,
    "bannerPriority" INTEGER NOT NULL DEFAULT 0,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhitelabelConfig" (
    "id" TEXT NOT NULL,
    "siteName" TEXT NOT NULL DEFAULT 'Shakti11',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1e40af',
    "secondaryColor" TEXT NOT NULL DEFAULT '#f59e0b',
    "accentColor" TEXT NOT NULL DEFAULT '#10b981',
    "bgColor" TEXT NOT NULL DEFAULT '#0f172a',
    "cardColor" TEXT NOT NULL DEFAULT '#1e293b',
    "textColor" TEXT NOT NULL DEFAULT '#f8fafc',
    "features" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhitelabelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldData" JSONB,
    "newData" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_parentId_idx" ON "User"("parentId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CricketEvent_cricketId_key" ON "CricketEvent"("cricketId");

-- CreateIndex
CREATE INDEX "CricketEvent_inPlay_idx" ON "CricketEvent"("inPlay");

-- CreateIndex
CREATE INDEX "CricketEvent_isSettled_idx" ON "CricketEvent"("isSettled");

-- CreateIndex
CREATE INDEX "Market_cricketEventId_idx" ON "Market"("cricketEventId");

-- CreateIndex
CREATE INDEX "Market_marketType_idx" ON "Market"("marketType");

-- CreateIndex
CREATE UNIQUE INDEX "Market_cricketEventId_externalMarketId_key" ON "Market"("cricketEventId", "externalMarketId");

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");

-- CreateIndex
CREATE INDEX "Bet_cricketEventId_idx" ON "Bet"("cricketEventId");

-- CreateIndex
CREATE INDEX "Bet_betStatus_idx" ON "Bet"("betStatus");

-- CreateIndex
CREATE INDEX "Bet_marketId_idx" ON "Bet"("marketId");

-- CreateIndex
CREATE INDEX "FancyBet_userId_idx" ON "FancyBet"("userId");

-- CreateIndex
CREATE INDEX "FancyBet_cricketEventId_idx" ON "FancyBet"("cricketEventId");

-- CreateIndex
CREATE INDEX "FancyBet_betStatus_idx" ON "FancyBet"("betStatus");

-- CreateIndex
CREATE INDEX "FancyBet_marketId_idx" ON "FancyBet"("marketId");

-- CreateIndex
CREATE INDEX "MatkaMarket_matkaId_idx" ON "MatkaMarket"("matkaId");

-- CreateIndex
CREATE INDEX "MatkaMarket_isMarketSettled_idx" ON "MatkaMarket"("isMarketSettled");

-- CreateIndex
CREATE INDEX "MatkaBet_userId_idx" ON "MatkaBet"("userId");

-- CreateIndex
CREATE INDEX "MatkaBet_matkaMarketId_idx" ON "MatkaBet"("matkaMarketId");

-- CreateIndex
CREATE INDEX "MatkaBet_betStatus_idx" ON "MatkaBet"("betStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRecord_betId_key" ON "CommissionRecord"("betId");

-- CreateIndex
CREATE INDEX "CommissionRecord_userId_idx" ON "CommissionRecord"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_activityType_idx" ON "ActivityLog"("activityType");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_cricketEventId_fkey" FOREIGN KEY ("cricketEventId") REFERENCES "CricketEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_cricketEventId_fkey" FOREIGN KEY ("cricketEventId") REFERENCES "CricketEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FancyBet" ADD CONSTRAINT "FancyBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FancyBet" ADD CONSTRAINT "FancyBet_cricketEventId_fkey" FOREIGN KEY ("cricketEventId") REFERENCES "CricketEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatkaMarket" ADD CONSTRAINT "MatkaMarket_matkaId_fkey" FOREIGN KEY ("matkaId") REFERENCES "Matka"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatkaBet" ADD CONSTRAINT "MatkaBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatkaBet" ADD CONSTRAINT "MatkaBet_matkaMarketId_fkey" FOREIGN KEY ("matkaMarketId") REFERENCES "MatkaMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

