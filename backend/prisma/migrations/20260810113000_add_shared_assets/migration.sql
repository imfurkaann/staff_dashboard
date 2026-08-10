-- CreateEnum
CREATE TYPE "SharedAssetStatus" AS ENUM ('AVAILABLE', 'LOANED', 'MAINTENANCE', 'RETIRED');

-- CreateTable
CREATE TABLE "SharedAsset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENEL',
    "brandModel" TEXT,
    "serialNo" TEXT,
    "status" "SharedAssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentHolderType" TEXT,
    "currentEmployeeId" TEXT,
    "currentRoomId" TEXT,
    "borrowedAt" TIMESTAMP(3),
    "expectedReturnDate" TIMESTAMP(3),
    "locationNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedAssetLog" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "borrowerName" TEXT,
    "employeeId" TEXT,
    "roomId" TEXT,
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "expectedReturnDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedAssetLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedAsset_assetCode_key" ON "SharedAsset"("assetCode");
CREATE INDEX "SharedAsset_status_idx" ON "SharedAsset"("status");
CREATE INDEX "SharedAsset_category_idx" ON "SharedAsset"("category");
CREATE INDEX "SharedAssetLog_assetId_idx" ON "SharedAssetLog"("assetId");

-- AddForeignKey
ALTER TABLE "SharedAsset" ADD CONSTRAINT "SharedAsset_currentEmployeeId_fkey" FOREIGN KEY ("currentEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SharedAsset" ADD CONSTRAINT "SharedAsset_currentRoomId_fkey" FOREIGN KEY ("currentRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SharedAssetLog" ADD CONSTRAINT "SharedAssetLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "SharedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedAssetLog" ADD CONSTRAINT "SharedAssetLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
