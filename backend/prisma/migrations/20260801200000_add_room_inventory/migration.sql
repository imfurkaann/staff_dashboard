CREATE TYPE "RoomInventoryStatus" AS ENUM (
  'HEALTHY',
  'MAINTENANCE_REQUIRED',
  'DAMAGED',
  'LOST',
  'IN_SERVICE',
  'REPLACEMENT_REQUIRED',
  'RETIRED'
);

CREATE TABLE "RoomInventory" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "RoomInventoryStatus" NOT NULL DEFAULT 'HEALTHY',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomInventory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoomInventory_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RoomInventory_roomId_status_idx" ON "RoomInventory"("roomId", "status");
CREATE UNIQUE INDEX "RoomInventory_roomId_itemName_location_key" ON "RoomInventory"("roomId", "itemName", "location");

INSERT INTO "RoomInventory" ("id", "roomId", "itemName", "location", "quantity", "installedAt", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."id", item."itemName", 'ODA ORTAK', 1, r."createdAt", 'HEALTHY'::"RoomInventoryStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Room" r
CROSS JOIN (VALUES ('Televizyon (Smart LED TV)'), ('Minibar (Buzdolabı)'), ('Klima (Inverter)')) AS item("itemName");

INSERT INTO "RoomInventory" ("id", "roomId", "itemName", "location", "quantity", "installedAt", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, b."roomId", 'Yatak (Ortopedik)', UPPER(b."bedLabel"), 1, b."createdAt", 'HEALTHY'::"RoomInventoryStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Bed" b;

INSERT INTO "RoomInventory" ("id", "roomId", "itemName", "location", "quantity", "installedAt", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, b."roomId", 'Baza (Sandıklı)', UPPER(b."bedLabel"), 1, b."createdAt", 'HEALTHY'::"RoomInventoryStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Bed" b;
