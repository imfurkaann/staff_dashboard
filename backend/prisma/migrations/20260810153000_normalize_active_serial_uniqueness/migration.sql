DROP INDEX IF EXISTS "RoomInventory_active_serialNo_key";

CREATE UNIQUE INDEX "RoomInventory_active_serialNo_key"
ON "RoomInventory" (UPPER(BTRIM("serialNo")))
WHERE "returnedAt" IS NULL AND "serialNo" IS NOT NULL AND BTRIM("serialNo") <> '';
