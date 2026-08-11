UPDATE "Room" SET "roomType" = 'PERSONEL_ODASI' WHERE "roomType" IS NULL;
ALTER TABLE "Room" ALTER COLUMN "roomType" SET NOT NULL;

ALTER TABLE "RoomCleaningLog" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RoomCleaningLog" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "RoomCleaningLog" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

DO $$ BEGIN
  ALTER TABLE "RoomCleaningLog" ADD CONSTRAINT "RoomCleaningLog_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Room" DROP CONSTRAINT IF EXISTS "Room_floor_check";
ALTER TABLE "Room" ADD CONSTRAINT "Room_floor_check" CHECK ("floor" BETWEEN -5 AND 200);
ALTER TABLE "Room" DROP CONSTRAINT IF EXISTS "Room_type_capacity_check";
ALTER TABLE "Room" ADD CONSTRAINT "Room_type_capacity_check" CHECK (
  ("roomType" = 'PERSONEL_ODASI' AND "capacity" BETWEEN 1 AND 26)
  OR
  ("roomType" IN ('ÇAMAŞIRHANE','DEPO','DUŞHANE','MESCİT','TEKNİK_ODA','MUTFAK','LOBİ','SPOR_SALONU','GÜVENLİK','DİĞER') AND "capacity" = 0)
);

ALTER TABLE "Block" DROP CONSTRAINT IF EXISTS "Block_genderPolicy_check";
ALTER TABLE "Block" ADD CONSTRAINT "Block_genderPolicy_check" CHECK ("genderPolicy" IN ('Male','Female','Mixed'));

ALTER TABLE "Bed" DROP CONSTRAINT IF EXISTS "Bed_occupancy_state_check";
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_occupancy_state_check" CHECK (
  ("isOccupied" = true AND "currentEmployeeId" IS NOT NULL)
  OR ("isOccupied" = false AND "currentEmployeeId" IS NULL)
);

ALTER TABLE "RoomCleaningLog" DROP CONSTRAINT IF EXISTS "RoomCleaningLog_status_check";
ALTER TABLE "RoomCleaningLog" ADD CONSTRAINT "RoomCleaningLog_status_check" CHECK ("status" IN ('NEEDS_CLEANING','IN_PROGRESS','CLEANED'));
ALTER TABLE "RoomCleaningLog" DROP CONSTRAINT IF EXISTS "RoomCleaningLog_completion_check";
ALTER TABLE "RoomCleaningLog" ADD CONSTRAINT "RoomCleaningLog_completion_check" CHECK (
  ("status" = 'CLEANED' AND "cleanedAt" IS NOT NULL)
  OR ("status" <> 'CLEANED' AND "cleanedAt" IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS "OccupancyLog_one_open_per_employee"
  ON "OccupancyLog"("employeeId") WHERE "checkOutDate" IS NULL AND "employeeId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "OccupancyLog_one_open_per_bed"
  ON "OccupancyLog"("bedId") WHERE "checkOutDate" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "RoomCleaningLog_one_active_per_room"
  ON "RoomCleaningLog"("roomId") WHERE "isDeleted" = false AND "status" <> 'CLEANED';
CREATE UNIQUE INDEX IF NOT EXISTS "RoomInventory_active_serial_key"
  ON "RoomInventory"("serialNo") WHERE "returnedAt" IS NULL AND "serialNo" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "RoomCleaningLog_isDeleted_roomId_status_idx" ON "RoomCleaningLog"("isDeleted", "roomId", "status");
CREATE INDEX IF NOT EXISTS "RoomCleaningLog_deletedById_idx" ON "RoomCleaningLog"("deletedById");
