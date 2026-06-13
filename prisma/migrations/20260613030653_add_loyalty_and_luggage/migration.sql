-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PointsTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EARNED',
    "reference" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LuggageItem" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tagNumber" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CHECKED_IN',
    "location" TEXT,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LuggageItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointsTransaction_customerId_createdAt_idx" ON "PointsTransaction"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LuggageItem_tagNumber_key" ON "LuggageItem"("tagNumber");

-- CreateIndex
CREATE INDEX "LuggageItem_bookingId_idx" ON "LuggageItem"("bookingId");

-- CreateIndex
CREATE INDEX "LuggageItem_tagNumber_idx" ON "LuggageItem"("tagNumber");

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LuggageItem" ADD CONSTRAINT "LuggageItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
