-- fills_ts is a raw-SQL TimescaleDB hypertable (see 20260629134858_add_timescaledb),
-- intentionally untracked by the Prisma schema — never let a diff drop it.

-- CreateEnum
CREATE TYPE "PositionSide" AS ENUM ('long', 'short');

-- CreateEnum
CREATE TYPE "PositionCloseType" AS ENUM ('reduce', 'close', 'flip');

-- CreateTable
CREATE TABLE "FundingRate" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosedPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "positionSide" "PositionSide" NOT NULL,
    "closeType" "PositionCloseType" NOT NULL,
    "entryPrice" INTEGER NOT NULL,
    "exitPrice" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "realizedPnl" INTEGER NOT NULL,
    "marginReleased" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosedPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingSettlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "payment" INTEGER NOT NULL,
    "marginAfter" INTEGER NOT NULL,
    "liquidationPriceAfter" INTEGER NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundingRate_symbol_settledAt_key" ON "FundingRate"("symbol", "settledAt");

-- CreateIndex
CREATE INDEX "ClosedPosition_userId_closedAt_idx" ON "ClosedPosition"("userId", "closedAt" DESC);

-- CreateIndex
CREATE INDEX "ClosedPosition_userId_symbol_closedAt_idx" ON "ClosedPosition"("userId", "symbol", "closedAt" DESC);

-- CreateIndex
CREATE INDEX "FundingSettlement_userId_settledAt_idx" ON "FundingSettlement"("userId", "settledAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FundingSettlement_userId_symbol_settledAt_key" ON "FundingSettlement"("userId", "symbol", "settledAt");

-- AddForeignKey
ALTER TABLE "FundingRate" ADD CONSTRAINT "FundingRate_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
